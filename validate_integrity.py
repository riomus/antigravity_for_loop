
import json
import sys
import os
import subprocess

def check_package_json():
    print("--- Checking package.json ---")
    try:
        with open('package.json', 'r') as f:
            data = json.load(f)
        print("JSON is valid.")
        
        if 'contributes' in data:
            if 'commands' in data['contributes']:
                print(f"Commands found: {len(data['contributes']['commands'])}")
                for cmd in data['contributes']['commands']:
                    print(f"  - {cmd['command']}")
            else:
                print("WARNING: No commands in contributes!")
        
        if 'activationEvents' in data:
            print(f"ActivationEvents: {data['activationEvents']}")
        else:
            print("WARNING: No activationEvents!")
            
    except Exception as e:
        print(f"package.json Error: {e}")
        return False
    return True

def check_extension_js():
    print("\n--- Checking extension.js syntax ---")
    try:
        # Simple syntax check using node
        result = subprocess.run(['node', '-c', 'extension.js'], capture_output=True, text=True)
        if result.returncode == 0:
             print("extension.js syntax is valid.")
        else:
             print(f"extension.js SYNTAX ERROR:\n{result.stderr}")
             return False
    except Exception as e:
         print(f"Error checking extension.js: {e}")
         return False
    return True

def check_lib_files():
    print("\n--- Checking lib/ files syntax ---")
    lib_files = ['lib/cdp-manager.js', 'lib/relauncher.js', 'lib/ralph-loop.js']
    all_ok = True
    for f in lib_files:
        if not os.path.exists(f):
            print(f"MISSING: {f}")
            all_ok = False
            continue
            
        try:
            result = subprocess.run(['node', '-c', f], capture_output=True, text=True)
            if result.returncode == 0:
                 print(f"{f} is valid.")
            else:
                 print(f"{f} SYNTAX ERROR:\n{result.stderr}")
                 all_ok = False
        except Exception as e:
             print(f"Error checking {f}: {e}")
             all_ok = False
    return all_ok

if __name__ == "__main__":
    pkg_ok = check_package_json()
    ext_ok = check_extension_js()
    lib_ok = check_lib_files()
    
    if not pkg_ok or not ext_ok or not lib_ok:
        sys.exit(1)
    print("\nValidation passed.")
