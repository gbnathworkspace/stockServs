import requests

# Test the API endpoint directly
response = requests.get("http://localhost:8000/nse_data/most-active-volume")
print("Status:", response.status_code)
if response.status_code == 200:
    data = response.json()
    print("\nFull response:")
    import json
    print(json.dumps(data, indent=2)[:1000])
    
    if 'most_active' in data and len(data['most_active']) > 0:
        print("\n\nFirst item structure:")
        print(json.dumps(data['most_active'][0], indent=2))
