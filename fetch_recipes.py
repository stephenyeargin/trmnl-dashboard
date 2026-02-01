#!/usr/bin/env python3
"""
Fetch recipes from TRMNL API and save to docs folder.
"""
import json
import urllib.request
import sys
from pathlib import Path

def fetch_recipes():
    """Fetch recipes from TRMNL API and save to docs/recipes.json"""
    url = "https://usetrmnl.com/recipes.json?user_id=12119"
    
    try:
        print(f"Fetching recipes from {url}...")
        # Add User-Agent header to avoid 403 Forbidden errors
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
        
        # Ensure docs directory exists
        docs_dir = Path(__file__).parent / "docs"
        docs_dir.mkdir(exist_ok=True)
        
        # Write to docs/recipes.json
        output_file = docs_dir / "recipes.json"
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"✓ Successfully saved {len(data.get('data', []))} recipes to {output_file}")
        return 0
        
    except Exception as e:
        print(f"✗ Error fetching recipes: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(fetch_recipes())
