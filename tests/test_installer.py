import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('skill_installer', ROOT / 'scripts/install_skills.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='amazon skills test ')
        self.base = Path(self.temp.name)
        self.source = ROOT / 'skills'
        self.names = installer.available_skills(self.source)
        self.dest = self.base / 'destination with spaces' / 'skills'

    def tearDown(self):
        self.temp.cleanup()

    def test_full_install_preserves_resources_and_repeated_install_skips(self):
        installer.apply_plan(installer.build_plan(self.source, self.names, [self.dest]))
        for name in self.names:
            self.assertEqual(installer.signature(self.source / name), installer.signature(self.dest / name))
        self.assertTrue((self.dest / 'amazon-product-direction/assets/亚马逊选品表.xlsx').is_file())
        self.assertTrue(all(item[2] == 'skip' for item in installer.build_plan(self.source, self.names, [self.dest])))

    def test_dry_run_creates_nothing(self):
        installer.apply_plan(installer.build_plan(self.source, self.names, [self.dest]), dry_run=True)
        self.assertFalse(self.dest.parent.exists())

    def test_conflict_preflight_does_not_partially_install_other_skills(self):
        conflicting = self.dest / self.names[-1]
        conflicting.mkdir(parents=True)
        (conflicting / 'user.txt').write_text('local change')
        with self.assertRaisesRegex(ValueError, '已有不同内容'):
            installer.build_plan(self.source, self.names, [self.dest])
        self.assertFalse((self.dest / self.names[0]).exists())
        self.assertEqual((conflicting / 'user.txt').read_text(), 'local change')

    def test_force_backs_up_local_changes_outside_discovery_directory(self):
        name = self.names[0]
        old = self.dest / name
        old.mkdir(parents=True)
        (old / 'local.txt').write_text('preserve me')
        installer.apply_plan(installer.build_plan(self.source, [name], [self.dest], force=True))
        backups = list(self.dest.parent.glob('amazon-select-skills-backups/*/*/local.txt'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_text(), 'preserve me')
        self.assertEqual(installer.signature(old), installer.signature(self.source / name))
        self.assertFalse(list(self.dest.parent.glob('.amazon-skills-stage-*')))

    def test_failed_replacement_restores_original(self):
        name = self.names[0]
        old = self.dest / name
        old.mkdir(parents=True)
        (old / 'local.txt').write_text('restore me')
        plan = installer.build_plan(self.source, [name], [self.dest], force=True)
        original_rename = Path.rename

        def fail_staged_move(source, destination):
            if source.parent.name.startswith('.amazon-skills-stage-'):
                raise OSError('test replacement failure')
            return original_rename(source, destination)

        with patch.object(Path, 'rename', fail_staged_move):
            with self.assertRaisesRegex(OSError, 'test replacement failure'):
                installer.apply_plan(plan)
        self.assertEqual((old / 'local.txt').read_text(), 'restore me')

    def test_profile_paths_and_project_requires_explicit_existing_root(self):
        home = self.base / 'fake home'
        expected = {'agents':'.agents/skills', 'codex':'.agents/skills', 'claude':'.claude/skills', 'cursor':'.cursor/skills', 'opencode':'.config/opencode/skills'}
        for agent, relative in expected.items():
            self.assertEqual(installer.target_dir(agent, 'global', home=home), home / relative)
        self.assertEqual(installer.target_dir('opencode', 'project', self.base), self.base.resolve() / '.opencode/skills')
        with self.assertRaises(ValueError):
            installer.target_dir('claude', 'project')
        with self.assertRaises(ValueError):
            installer.target_dir('claude', 'project', self.base / 'not-created')

    def test_selection_all_and_duplicate_profiles_are_deduplicated(self):
        with patch.object(Path, 'home', return_value=self.base), patch.object(installer, 'apply_plan') as apply:
            self.assertEqual(installer.main(['--agent','codex','--agent','agents','--skill',self.names[0]]), 0)
            self.assertEqual(len(apply.call_args.args[0]), 1)
            installer.main(['--agent','all','--dry-run'])
            self.assertEqual(len(apply.call_args.args[0]), len(self.names)*4)

    def test_invalid_options_cannot_install(self):
        for args in [['--skill','../wrong'],['--dest',str(self.dest),'--agent','claude'],['--project-dir',str(self.base)],['--scope','project'],['--skill','all','--skill',self.names[0]]]:
            with self.assertRaises(ValueError):
                installer.main(args)
        self.assertFalse(self.dest.exists())

    def test_symlink_target_and_source_overlap_are_rejected(self):
        external = self.base / 'external'
        external.mkdir()
        self.dest.mkdir(parents=True)
        try:
            (self.dest / self.names[0]).symlink_to(external, target_is_directory=True)
        except OSError:
            self.skipTest('symlinks unavailable on host')
        with self.assertRaises(ValueError):
            installer.build_plan(self.source, [self.names[0]], [self.dest], force=True)
        with self.assertRaises(ValueError):
            installer.build_plan(self.source, [self.names[0]], [self.source], force=True)

    def test_actual_cli_custom_destination_and_list(self):
        script = ROOT / 'scripts/install_skills.py'
        listing = subprocess.run([sys.executable,str(script),'--list'],check=True,capture_output=True,text=True)
        self.assertEqual(listing.stdout.splitlines(),self.names)
        subprocess.run([sys.executable,str(script),'--dest',str(self.dest),'--skill','amazon-profit-analysis'],check=True,capture_output=True,text=True,cwd=self.base)
        self.assertTrue((self.dest / 'amazon-profit-analysis/scripts/calculate_profit.mjs').is_file())
        self.assertFalse((self.dest / 'amazon-product-direction').exists())

    def test_actual_project_install(self):
        script = ROOT / 'scripts/install_skills.py'
        subprocess.run([sys.executable,str(script),'--agent','claude','--scope','project','--project-dir',str(self.base)],check=True,capture_output=True,text=True)
        for name in self.names:
            self.assertEqual(installer.signature(self.source / name),installer.signature(self.base / '.claude/skills' / name))

    def test_category_only_install_is_self_contained(self):
        script = ROOT / 'scripts/install_skills.py'
        subprocess.run([sys.executable,str(script),'--dest',str(self.dest),'--skill','amazon-category-analysis'],check=True,capture_output=True,text=True,cwd=self.base)
        package = self.dest / 'amazon-category-analysis'
        for name in ['market-capacity.md','category-competition.md','output-contract.md']:
            self.assertTrue((package / 'references' / name).is_file())
        self.assertEqual(installer.signature(package), installer.signature(self.source / 'amazon-category-analysis'))
        self.assertFalse((self.dest / 'amazon-product-direction').exists())
        self.assertFalse((self.dest / 'amazon-profit-analysis').exists())

    def test_category_rule_mirror_is_current_for_independent_selection_install(self):
        subprocess.run([sys.executable,str(ROOT / 'scripts/sync_category_reference.py'),'--check'],check=True,capture_output=True,text=True,cwd=self.base)
        subprocess.run([sys.executable,str(ROOT / 'scripts/install_skills.py'),'--dest',str(self.dest),'--skill','amazon-product-direction'],check=True,capture_output=True,text=True)
        reference = self.dest / 'amazon-product-direction/references/category-competition.md'
        self.assertEqual(reference.read_bytes(), (self.source / 'amazon-category-analysis/references/category-competition.md').read_bytes())
        self.assertFalse((self.dest / 'amazon-category-analysis').exists())

    @unittest.skipIf(shutil.which('sh') is None,'POSIX shell unavailable')
    def test_shell_entrypoint_from_other_working_directory(self):
        subprocess.run(['sh',str(ROOT/'install.sh'),'--dest',str(self.dest),'--skill','amazon-product-direction'],cwd=self.base,check=True,capture_output=True,text=True)
        self.assertTrue((self.dest/'amazon-product-direction/assets/亚马逊选品表.xlsx').is_file())


if __name__ == '__main__':
    unittest.main()
