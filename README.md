# DXB-CLI

A cli plugin for the Salesforce CLI built by David Browaeys containing a lot of helpful commands. 

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

3. Link nab-cli plugin to SFDX (non admin), go to dxb-cli folder and execute

    ```shell
    sfdx plugins:link
    ```

## Topics
```
  dxb:apex        A set of commands that allow to manilpulate apex.
  dxb:community   Publish community(network) using connect api.
  dxb:data        A set of commands that allows to manipulate and optimize data.
  dxb:delta       A set of commands that generate delta package for faster deployment.
  dxb:mdapi       A set of commands that extends dx mdapi topic.
  dxb:object      A set of commands in regards to salesforce objects.
  dxb:org         A set of commands for scratch org and sandbox
  dxb:permission  Create fieldset for specified object and push to scratch org.
  dxb:profile     A set of commands that allow to manipuilate and faciliate salesforce profiles.
  dxb:static      A set of commands regarding static resource
  dxb:user        set defaut username and org wide email in metadata such as workflow based on target scratch org
```
