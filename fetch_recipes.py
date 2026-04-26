#!/usr/bin/env python3
"""
Fetch recipes from TRMNL API and save to docs folder.
"""
import json
import urllib.request
import sys
from pathlib import Path
from urllib.parse import urlparse


USER_AGENT = {"User-Agent": "Mozilla/5.0"}
CONTENT_TYPE_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
}


def fetch_json(url):
    """Fetch JSON payload from URL."""
    req = urllib.request.Request(url, headers=USER_AGENT)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())


def guess_extension(content_type, source_url):
    """Determine file extension from response content type or source URL path."""
    if content_type:
        clean_type = content_type.split(";", 1)[0].strip().lower()
        mapped = CONTENT_TYPE_TO_EXT.get(clean_type)
        if mapped:
            return mapped

    suffix = Path(urlparse(source_url).path).suffix.lower()
    if suffix:
        return suffix
    return ".img"


def cache_screenshot(url, recipe_id, screenshots_dir):
    """Download screenshot and return local relative URL for docs output."""
    req = urllib.request.Request(url, headers=USER_AGENT)
    with urllib.request.urlopen(req) as response:
        content_type = response.headers.get("Content-Type", "")
        extension = guess_extension(content_type, url)
        filename = f"{recipe_id}{extension}"
        output_path = screenshots_dir / filename
        output_path.write_bytes(response.read())
    return f"./assets/screenshots/{filename}"

def fetch_recipes():
    """Fetch recipes from TRMNL API and save to docs/recipes.json"""
    url = "https://trmnl.com/recipes.json?user_id=12119"
    
    try:
        print(f"Fetching recipes from {url}...")
        data = fetch_json(url)
        
        # Ensure docs directory exists
        docs_dir = Path(__file__).parent / "docs"
        docs_dir.mkdir(exist_ok=True)

        screenshots_dir = docs_dir / "assets" / "screenshots"
        screenshots_dir.mkdir(parents=True, exist_ok=True)

        # Remove previously cached screenshots to keep build output fresh.
        for existing_file in screenshots_dir.glob("*"):
            if existing_file.is_file():
                existing_file.unlink()

        recipes = data.get("data", [])
        cached_count = 0
        for recipe in recipes:
            screenshot_url = recipe.get("screenshot_url")
            recipe_id = recipe.get("id")
            if not screenshot_url or not recipe_id:
                recipe["local_screenshot_url"] = ""
                continue

            try:
                local_url = cache_screenshot(screenshot_url, recipe_id, screenshots_dir)
                recipe["local_screenshot_url"] = local_url
                cached_count += 1
            except Exception as err:
                print(
                    f"! Failed to cache screenshot for recipe {recipe_id}: {err}",
                    file=sys.stderr,
                )
                recipe["local_screenshot_url"] = ""
        
        # Write to docs/recipes.json
        output_file = docs_dir / "recipes.json"
        with open(output_file, "w") as f:
            json.dump(data, f, indent=2)
        
        print(
            f"✓ Successfully saved {len(recipes)} recipes to {output_file} "
            f"and cached {cached_count} screenshots"
        )
        return 0
        
    except Exception as e:
        print(f"✗ Error fetching recipes: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(fetch_recipes())
