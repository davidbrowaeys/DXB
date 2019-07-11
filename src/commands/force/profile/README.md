## Profile Usage
1. pull from origin/develop
	git pull origin develop
2. push to scratch org new changes
	sfdx force:source:push -u myorg
3. convert profiles xml files to json
	deloitte force:profile:convert
4. make change in scratch org
	sfdx force:source:pull -u myorg
5. re-convert profiles xml files to json
	deloitte force:profile:convert
6. rebuild profile meta xml files from json files
	deloitte force:profile:build
