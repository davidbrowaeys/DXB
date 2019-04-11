![](https://github.aus.thenational.com/raw/EntCRM/nab-cli/master/lib/wiki_banner.png?token=AAAXEQhWOv4F5ylTLKm1gY8TahBX_Z-Pks5a9M3dwA%3D%3D)

# DXB-CLI

A DXB plugin for the Salesforce CLI built by David Browaeys containing a lot of helpful commands. 

## Pre-requisite
1. Install [SDFX CLI](https://developer.salesforce.com/tools/sfdxcli) 

2. Install [node.js. + npm](https://nodejs.org/en/). 
Once installed, checkout proxy setting if you are behind corporate proxy.

## Proxy Settings

1. Config npm proxy one by one in a new terminal(no admin required)

    ```shell
    npm config set https-proxy http://address:port
    npm config set proxy http://address:port
    npm config set sslVerify false
    npm config set strict-ssl false
    ```

## Install DXB-CLI

1. go to your workspace and clone the repository:

    ```shell
    git clone https://github.com/davidbrowaeys/DXB.git
    ``` 

2. Go to dxb-cli folder and install npm modules (as a admin): 

    ```shell
    cd DXB
    npm install
    ```

3. Link nab-cli plugin to SFDX (non admin), go to nab-cli folder and execute

    ```shell
    sfdx plugins:link
    ```
