## Profile Usage
1. pull from origin/develop
	git pull origin develop
2. push to scratch org new changes / push to sandbox
	sf project deploy start --target-org myorg
3. convert profiles xml files to json
	sf dxb profile convert
4. make change in scratch org
	sf project deploy retrieve --target-org myorg
5. re-convert profiles xml files to json
	sf dxb profile convert
6. rebuild profile meta xml files from json files
	sf dxb profile build
