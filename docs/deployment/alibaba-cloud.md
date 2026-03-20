---
sidebar_position: 11
title: Alibaba Cloud
---

# Deploy on Alibaba Cloud

## Introduction

Deploy a ready-to-use Authorizer instance on [Alibaba Cloud](https://www.alibabacloud.com/) using the **Alibaba Cloud Compute Nest** service.

## Requirements

An [Alibaba Cloud account](https://www.alibabacloud.com/).

## One-click Deploy

[![Deploy on Alibaba Cloud](https://service-info-public.oss-cn-hangzhou.aliyuncs.com/computenest-en.svg)](https://computenest.console.aliyun.com/service/instance/create/default?type=user&ServiceName=Authorizer%E7%A4%BE%E5%8C%BA%E7%89%88)

1. Select parameters for the type of ECS to deploy
2. Choose to create a new dedicated network or use an existing one
3. Click **Create Now** and wait for the service instance to be deployed

## Configure for v2

After deployment, configure the required v2 variables in your instance:

```bash
./build/server \
  --database-type=sqlite \
  --database-url=test.db \
  --jwt-type=HS256 \
  --jwt-secret=test \
  --admin-secret=admin \
  --client-id=123456 \
  --client-secret=secret
```
