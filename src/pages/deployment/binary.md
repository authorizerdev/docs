---
title: Binaries
layout: ../../layouts/Main.astro
---

Deploy / Try Authorizer using binaries. With each [Authorizer Release](https://github.com/authorizerdev/authorizer/releases)
binaries are baked with required deployment files and bundled. You can download a specific version of it for the following operating systems:

- Mac OSX
- Linux
- Windows

## Getting Started

### Step 1: Download and unzip bundle

- Download the Bundle for the specific OS from the [release page](https://github.com/authorizerdev/authorizer/releases)

> Note: For windows, it includes `.zip` file. For Linux & MacOS, it includes `.tar.gz` file.

- Unzip using following command

  - Mac / Linux

  ```sh
  tar -zxf AUTHORIZER_VERSION -c authorizer
  ```

  - Windows

  ```sh
  unzip AUTHORIZER_VERSION
  ```

- Change directory to `authorizer`

  ```sh
  cd authorizer
  ```

### Step 2: Configure environment variables

Required environment variables are pre-configured in `.env` file. But based on the production requirements, please configure more environment variables. You can refer to [environment variables docs](/core/env) for more information.

### Step 3: Start Authorizer

- Run following command to start authorizer

  ```sh
  ./build/server
  ```

> Note: For mac users, you might have to give binary the permission to execute. Here is the command you can use to grant permission `xattr -d com.apple.quarantine build/server`

That's all you need to start a server!

## Running binary for production

Often we deploy our services on linux machine and run them as daemon process, you can do same with authorizer. After following the above mentioned steps you can follow this steps to create a daemon process:

### Step 1: Create a `systemd` service file

- Run following command in your terminal to create a service file
  ```sh
  sudo touch /etc/systemd/system/authorizer.service
  ```

### Step 2: Configure service file

- Copy following content into `/etc/systemd/system/authorizer.service`

  ````
  [Unit]
  Description=authorizer

  [Service]
  Type=simple
  Restart=always
  RestartSec=5
  ExecStart=/path_to_authorizer_parent_folder/authorizer/build/server
  WorkingDirectory=/path_to_authorizer_parent_folder/authorizer/

  [Install]
  WantedBy=multi-user.target
  ```
  ````

### Step 3: Start Service

Run following commands in your terminal

- Reload configurations: `sudo systemctl daemon-reload`
- Restart authorizer: `sudo systemctl restart authorizer`
