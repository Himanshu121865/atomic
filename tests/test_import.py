import atomic


def test_package_imports_and_has_version():
    assert atomic.__version__ == "0.1.0"
