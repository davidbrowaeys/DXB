![](https://github.aus.thenational.com/raw/EntCRM/nab-cli/master/lib/wiki_banner.png?token=AAAXEQhWOv4F5ylTLKm1gY8TahBX_Z-Pks5a9M3dwA%3D%3D)

# NAB-CLI

A NAB plugin for the Salesforce CLI built by David Browaeys containing a lot of helpful commands. 

## Pre-requisite
1. Install [SDFX CLI](https://developer.salesforce.com/tools/sfdxcli) 

2. Install [node.js. + npm](https://nodejs.org/en/). 
Once installed, checkout proxy setting if you are behind corporate proxy.

3. Install yarn (as a admin) :
    1. using npm in terminal(not always works):
    ```shell
    npm install -g yarn
    ```
    2. from [website](https://yarnpkg.com/en/) (easiest)

Once installed, checkout proxy setting if you are behind corporate proxy.

## Proxy Settings

1. Config npm proxy one by one in a new terminal(no admin required)

    ```shell
    npm config set https-proxy http://address:port
    npm config set proxy http://address:port
    npm config set sslVerify false
    npm config set strict-ssl false
    ```

2. Config yarm proxy (same way as npm) one by one in a new terminal(no admin required)

    ```shell
    yarn config set https-proxy http://address:port
    yarn config set proxy http://address:port
    yarn config set sslVerify false
    yarn config set strict-ssl false
    ```

## Install NAB-CLI

1. go to your workspace and clone the repository:

    ```shell
    git clone git@github.aus.thenational.com:EntCRM/nab-cli.git
    ``` 

2. Go to nab-cli folder and install npm modules (as a admin): 

    ```shell
    cd nab-cli
    npm install
    ```

3. Link nab-cli plugin to SFDX (non admin), go to nab-cli folder and execute

    ```shell
    sfdx plugins:link
    ```

## Usage

### ENV commands

#### Create dbx scratch org with code and data

```shell
Usage: sfdx nab:env:create

Create nab standard scratch org

Flags:
 -s, --defaultorg                 mark as default org
 -d, --durationdays DURATIONDAYS  duration of the scratch org (in days) (default:30, min:1, max:30)
 -f, --includedata                indicate if nab data need to be imported
 -p, --includepackages            include packages from cli config file
 -u, --orgname ORGNAME            name of scratch org

help text for nab:env:create
```

#### Deploy source code 

```shell
Usage: sfdx nab:env:deploy

Convert DX files to metadata and deploy to target env

Flags:
 -u, --orgname ORGNAME  (required) name of scratch org
 --json                 return json format

help text for nab:env:deploy
```

#### Full or delta data backup

```shell
Usage: sfdx nab:env:backup

Perform data backup of target environment

Flags:
 -m, --delta DELTA                Backup data since last runtime
 -u, --orgname ORGNAME            name of scratch org
 -d, --outputdir OUTPUTDIR        output directory path to store files
 -r, --resultformat RESULTFORMAT  format of the output files: csv(default), xml, or json

help text for nab:env:backup
```

### Code Commands

#### Create class

```shell
Usage: sfdx nab:code:class

Apex class creation

Flags:
 -n, --apiname APINAME        (required) api name of the class
 -v, --apiversion APIVERSION  Api version of metadata, default 42.0
 -u, --orgname ORGNAME        name of scratch org
 -t, --template TEMPLATE      apex class template, choose one of the following available tempplates:
                              Constructor(default)
                              NoConstructor
                              Batch
                              Schedulable
                              ServiceClass
                              Exception
                              TestClass
 --push                       push class automatically to scratch org after creation

help text for apex:class:handler:create
```

#### Create trigger

```shell
Usage: sfdx nab:code:trigger

Create trigger handler class using SObjectDomain framework

Flags:
 -o, --sobject SOBJECT  (required) SObject

help text for nab:code:trigger
```

### Config Commands

#### Create static resource

```shell
Usage: sfdx nab:config:static

Create static resource

Flags:
 -c, --cachecontrol CACHECONTROL  public or private static resource
 -d, --description DESCRIPTION    (required) description
 -f, --file FILE                  (required) path of the file to create
 -n, --name NAME                  (required) static resource name
 --push                            push to scratch org

help text for nab:config:static
```

#### Create custom label

```shell
Usage: sfdx nab:config:label

Create custom label

Flags:
 -c, --categories CATEGORIES  categories
 -n, --name NAME              (required) name of custom label
 -u, --orgname ORGNAME        name of scratch org
 -v, --value VALUE            (required) value
 --push                       push to scratch org

help text for nab:config:label
```
