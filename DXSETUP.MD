License Requests
Github : https://developerportal.launchpad.ext.national.com.au/github/grantaccess
Go to myId: go/myidprod and request for the following access :
SFDX: Salesforce CRM - Aus Developer Team - AUR
Jenkins: Enterprise Jenkins - SCM User Access (DEV) - Basic User Access

Software
You will find all software on the NAB Self Service catalogue. 

Git & Git Client
To setup account on github follow steps mentioned on below page

https://teams.cts.nab.com.au/workspaces/DeliveryAtNAB/Tools/GitHubEnterprise.aspx

We firstly need to install Git, and optionally you can install a Git Client.

You can download Git for windows here:

https://git-scm.com/download/mac

Or if you are using a linux vm you can follow the instructions to install git for linux here:

https://git-scm.com/download/linux

Simply download the relevant executable and install it within your local machine. It is recommended to accept all defaults during installation.

Setting up SSH
Follow the GitHub documentation to achieve SSH authentication with your GitHub repository. First generate an SSH key:

https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/

Note: To modify your .ssh/config - you need do the following

Launch the Terminal and type the following:
     nano ~/.ssh/config

Copy & paste the following into the nano window: 
 Host *
 AddKeysToAgent yes
 UseKeychain yes
 IdentityFile ~/.ssh/id_rsa
Control+O to save the file, then Control+X to quit out of nano.


Then add the generated SSH key to GitHub:

https://help.github.com/articles/adding-a-new-ssh-key-to-your-github-account/

Once you have Git installed and configured, it is optional if you want to download a Git Client. Source Tree, Git Kraken and Git Extensions are all Git Clients that can be used if you are not comfortable in Command Prompt/Git Bash.

Node.js & NPM
NPM is required by Salesforce CLI to enable proxy settings when working behind Firewall. The Node.js installation file can be found here:

https://nodejs.org/en/download/

Salesforce CLI
You should be able to find the Salesforce CLI on the NAB self service catalogue - if it isn't available please contact your lead to get you added to the group. 



Alternatively Salesforce CLI can either be installed via NPM* or via the downloadable executable (if you have admin credentials). You can find the install instructions for Salesforce CLI here:

https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm

*note: to install using NPM you have to have configured the proxy settings for NPM. You will have to complete the below Proxy steps before installing Salesforce CLI via NPM.

Proxy
The proxy information needs to be added to NPM as well as the Environment Variables.

Run the commands below in sequencial order in Terminal to setup proxy information. This is just a one time setting. 

npm config set https-proxy http://sparpxyapp.aur.national.com.au:8080
npm config set proxy http://sparpxyapp.aur.national.com.au:8080
npm config set sslVerify false
npm config set strict-ssl false


Open Terminal
Run in terminal:
touch ~/.bash_profile; open ~/.bash_profile
In TextEdit, add

export HTTP_PROXY=http://sparpxyapp.aur.national.com.au:8080

export HTTPS_PROXY=http://sparpxyapp.aur.national.com.au:8080

 Run in terminal:

 source ~/.bash_profile



A useful command if you always get asked for credentials when running git commands is:

ssh-add -K

It's a background program that handles ssh credentials for you i.e. you won't need to enter credentials each time. 

Text Editor/IDE
Now that Salesforce CLI and Git have been installed, you now need to setup a Text Editor and/or an IDE to begin working with the Salesforce DX project. Here are the recommended tooling available:

Visual Studio Code & Salesforce DX Extensions
 
 
 
https://code.visualstudio.com/download

https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode

DX Release Notes
https://developer.salesforce.com/media/salesforce-cli/releasenotes.html
