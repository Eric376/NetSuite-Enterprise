import requests
import re
from requests_oauthlib import OAuth1
from datetime import datetime, timedelta

# Start QB API Fetch
print("start---------------------------------------------------")
QB_API_URL = 'https://api.quickbase.com/v1/records/query'

# Headers for Quickbase API
qb_headers = {
  	'QB-Realm-Hostname': 'account.quickbase.com',
	'User-Agent': '{User-Agent}',
	'Authorization': f'QB-USER-TOKEN b5xxxxxxxxxx',
        'Content-Type': 'application/json'
}

# Query body for Quickbase API
today_date = datetime.now() - timedelta(days=7)
formatted_date = today_date.strftime('%m-%d-%Y')

body = {
    "from": "bs9xxxxxx",  # Replace with your table DBID
    "select": [6, 9]
}

# Make request to Quickbase
response = requests.post(QB_API_URL, headers=qb_headers, json=body)
values = []

# Process Quickbase API response
if response.status_code == 200:
    for item in response.json().get('data', []):
        values.append(item['6']['value'])
else:
    print(f"Error fetching data: {response.status_code}, {response.text}")

# NetSuite OAuth1 credentials
ACCOUNT_ID = '98xxxxxxx_SB'          
CONSUMER_KEY = '981xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
CONSUMER_SECRET = '0272d83xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
TOKEN_ID = '7aexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
TOKEN_SECRET = '3f9ea1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
ROLE_ID = '3'

realm = ACCOUNT_ID.split('_')[0]

# OAuth1 for NetSuite
auth = OAuth1(
    client_key=CONSUMER_KEY,
    client_secret=CONSUMER_SECRET,
    resource_owner_key=TOKEN_ID,
    resource_owner_secret=TOKEN_SECRET,
    signature_type='auth_header',
    signature_method='HMAC-SHA256',  # Explicitly set signature method
    realm=ACCOUNT_ID
)

# NetSuite SuiteQL endpoint
SUITEQL_ENDPOINT = f"https://{realm.lower()}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql"

# Headers for NetSuite API
ns_headers = {
    'Content-Type': 'application/json',
    'Prefer': 'transient'
}

# Query NetSuite with values from Quickbase
for value in values:
    text = re.sub(r',? ?Inc\.?| ?LLC\.?| ?llc$', '', value)
    #print(text)
    queryy = {
        "q": f"select companyName, id from customer where companyName = '{text}';"
    }
    query = {
        "q": f"select companyName, id from customer where companyName like '%{text}%';"
    }
    responsee = requests.post(SUITEQL_ENDPOINT, json=queryy, auth=auth, headers=ns_headers)
    companies = []
    dataa = response.json()
    itemss = dataa.get('items',[])
    if itemss:
        dataa = responsee.json()
        itemss = dataa.get('items',[])
        for result in itemss:
            companies.append(result.get('companyname'))
        print(f"Found in NS - QB: ",value," | NS: ",companies)    
    else:
        #print(f"Not Found QB: {value}, Error: {response.status_code}, {response.text}")
        response = requests.post(SUITEQL_ENDPOINT, json=query, auth=auth, headers=ns_headers)
        data = response.json()
        items = data.get('items',[])
        if items:
            data = response.json()
            items = data.get('items',[])
            for result in items:
                companies.append(result.get('companyname'))
            print(f"Found in NS - QB: ",value," | NS: ",companies)    
        else:
            print(f"Not Found QB: {value}, Error: {response.status_code}, {response.text}")
