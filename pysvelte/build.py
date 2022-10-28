"""Helper functions to build visualizations using HTML/web frameworks."""
import subprocess
from filehash.filehash import FileHash
from pathlib import Path

from IPython.display import HTML, Javascript, display


def bundle_source(entry: Path) -> Path:
    """Bundle up the JavaScript/TypeScript source

    Requires the source file to have a default export of a HTML element. This
    will then be converted into a web custom element.

    Supports common frameworks including Lit and React.

    Args:
        entry (Path): Source path, which must have a default export of a
        HTML element.

    Returns:
        Path: Path to the bundled JavaScript output
    """
    # Get the package.json path (the bundler script is setup here)
    package_json_dir = Path(__file__).parent
    esbuild_script = package_json_dir / "esbuild.js"

    # Set the output file path (with a hash to prevent conflicts)
    out_dir = Path(__file__).parent / ".build"
    stem = entry.stem + "-" + FileHash("md5").hash_file(entry)
    out_file = out_dir / f"{stem}.js"

    # Bundle the source
    subprocess.run([
        "node",
        str(esbuild_script.absolute()),
        f"--entry={str(entry.absolute())}",
        "--bundle",
        f"--outfile={str(out_file)}",
        "--format=esm"
    ],
        cwd=package_json_dir.absolute(),
        # stderr=subprocess.STDOUT,
        # capture_output=True
        stdout=subprocess.DEVNULL  # Don't output to the console
    )

    # Return the bundled output file
    return out_file


def create_custom_element_script(
    bundled_js_path: Path,
    custom_element_name: str,
) -> str:
    """Create a script that will create the custom element

    Args:
        bundled_js_path (Path): Path to the bundled JavaScript that exports a
        default HTML element.
        custom_element_name (str): Custom name for the element.

    Returns:
        str: HTML that imports the script and creates the custom element
    """
    # Read the bundled JavaScript file
    with open(bundled_js_path) as file:
        bundled_js = file.read()

    return f"""<script type="module">
        {bundled_js}
        window.customElements.define("{custom_element_name}", CustomVisualization);
        </script>
        """


def create_custom_element(custom_element_name: str, **kwargs: str) -> str:
    """Create the custom element

    Args:
        custom_element_name (str): Name for the custom element (must be globally
        unique for the user so keep long and descriptive).
        **kwargs (str): Parameters to be provided to the custom element.

    Returns:
        str: Custom element with parameters
    """
    # Format the custom element parameters
    params_list = [f"{name}='{value}'" for name, value in kwargs.items()]
    params = " ".join(params_list)

    # Return the custom element
    return f"<{custom_element_name} {params}/>"


def render(entry: Path, **kwargs) -> HTML:
    """Render a visualization as a HTML custom element

    https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements

    Args:
        entry (Path): Source path, which must have a default export of a
        HTML element.
        unique for the user so keep long and descriptive).
        **kwargs (str): Parameters to be provided to the custom element.

    Returns:
        HTML: HTML Visualization
    """
    # Bundle the source code
    bundled_js_path = bundle_source(Path(entry))

    # Custom elements must have unique names, including a hyphen. They cannot be
    # redefined, so if the source changes we also want to change the element
    # name. Since the compiled javascript filename includes a hash of the file,
    # we simply also use this filename as the custom element name.
    custom_element_name = bundled_js_path.stem.replace("_", "-")

    # Create and return the html
    script = create_custom_element_script(bundled_js_path, custom_element_name)
    custom_element = create_custom_element(custom_element_name, **kwargs)
    return HTML(script + "\n" + custom_element)


def dev() -> None:
    """Enable development mode

    Run this at the top of a notebook, if you want to enable re-loading of
    visualization components (when you're editing them).
    
    Utilizes a global custom browser patch, to allow redefining of web custom
    elements. https://github.com/caridy/redefine-custom-elements

    @example
    ```
    %load_ext autoreload
    %autoreload 2
    from pysvelte import build
    build.dev()
    ```
    """
    # Get the patch
    redefine_custom_elements_path = Path(__file__).parent / "node_modules" \
        / "redefine-custom-elements" / "lib" / "index.js"

    with open(redefine_custom_elements_path) as file:
        source = file.read()

    # Serve within the notebook
    script = Javascript(data=source)
    display(script)
