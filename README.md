标题：http使用restful代理soap协议

引言：作为建立在http协议之上的数据协议，soap定义了数据报文的格式与规范与应用程序的调用方式（RPC模式），即隐藏了网络传输的细节。

# 1、soap

`simple object accessProtocol`：简单的对象访问协议，采用XML格式来作为数据报文，拥有着RPC的特性，所以注定适用于早期的分布式计算环境中。

## 1.1、对比http

两个概念，http是应用协议，soap是基于http之上的数据协议。http只负责数据的传递，无论数据是图片，网页，文件……，在流转链路中，统一以文本方式处理。soap定义了一种规约：如何把请求&响应传递的XML文本数据，解析成对象。

总结下来就是：soap = rpc模式 + http传输 + xml报文，硬说区别可以列举如下三点：

- http是一种超文本传输协议，规定的传输内容皆为文本；
- soap是http的高级应用，以结构化的xml数据来作为报文；
- server 与 client存在格式化解析报文，故完整的请求流程会牺牲一点性能。

## 1.2、webservice

soap基础上的实际应用，早期的分布式应用程序。下面以java为例，分别搭建server 和client。

### 1.2.1、server

采用JAX-WS框架快速构建的方式搭建一个webservice server。

对外提供一个API：sayHelloWorldFrom

```java
package example;

import javax.jws.WebMethod;
import javax.jws.WebService;
import javax.xml.ws.Endpoint;

/**
 * @ClassName ${NAME}
 * @Description TODO
 * @Date 2022/8/15 2:15 H
 * @Author ikejcwang
 * @Version 1.0.0
 **/
@WebService()
public class HelloWorld {

    @WebMethod
    public String sayHelloWorldFrom(String from) {
        String result = "Hello, world, from " + from;
        System.out.println(result);
        return result;
    }

    public static void main(String[] argv) {
        Object implementor = new HelloWorld();
        String address = "http://localhost:9000/HelloWorld";
        Endpoint.publish(address, implementor);
    }
}
```

启动main函数后，浏览器打开链接：`http://localhost:9000/HelloWorld?wsdl`，可以查阅server对外提供的wsdl文档

### 1.2.2、wsdl

框架内置了wsdl生成，作为介绍该webservice server的功能特点，对外提供了哪些函数API，这些函数的参数结构，约束条件，参数如何组装成soap报文。方便客户端无障碍调用；

### 1.2.3、client

采用JAX-WS框架针对特定的wsdlURL，快速自动生成客户端的class。如下所示：

```shell
└── src
    ├── example
    │   └── HelloWorldClient.java
    └── vip
        └── wangjc
            ├── HelloWorld.class
            ├── HelloWorld.java
            ├── HelloWorld.wsdl
            ├── HelloWorldService.class
            ├── HelloWorldService.java
            ├── ObjectFactory.class
            ├── ObjectFactory.java
            ├── SayHelloWorldFrom.class
            ├── SayHelloWorldFrom.java
            ├── SayHelloWorldFromResponse.class
            ├── SayHelloWorldFromResponse.java
            ├── package-info.class
            └── package-info.java
```

main函数如下：

```java
package example;

import vip.wangjc.HelloWorld;
import vip.wangjc.HelloWorldService;

/**
 * @ClassName ${NAME}
 * @Description TODO
 * @Date 2022/8/15 3:07 H
 * @Author ikejcwang
 * @Version 1.0.0
 **/
public class HelloWorldClient {
    public static void main(String[] argv) {
        HelloWorld service = new HelloWorldService().getHelloWorldPort();
        //invoke business method
        String result = service.sayHelloWorldFrom("haha ikejcwang");	// 远程调用的逻辑实现
        System.out.println(result);

        try {
            Thread.sleep(20000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}
```

### 1.2.4、抓包

启动server，然后继续启动client，通过抓包采集下client发送的报文，如图所示

![image-20220819131845066](/Users/wangjinchao/Library/Application Support/typora-user-images/image-20220819131845066.png)

根据抓包信息来看，可以推测发现，client是先获取wsdl文档，将wsdl文档缓存在当前内存中，然后根据wsdl文档提供的规约来将需要调用的对象组装成XML文本，然后发起http请求。

为什么会说它会将wsdl文档缓存起来？可以修改client->main函数，调用两次`sayHelloWorldFrom`，会发现只有在最开始时，或是程序启动时访问了/url?wsdl链接，后续都是直接发起http业务请求的；

数据报文如下：

```xml
<?xml version='1.0' encoding='UTF-8'?>
<S:Envelope
    xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">
    <S:Body>
        <ns2:sayHelloWorldFrom
            xmlns:ns2="http://example/">
            <arg0>haha ikejcwang</arg0>
        </ns2:sayHelloWorldFrom>
    </S:Body>
</S:Envelope>
```

### 1.2.5、post调用？

既然知道，它是基于http协议发起调用的，也通过抓包拿到了它的请求报文，按理，postman或者任意的http client都可以发起调用；

![image-20220819133034978](/Users/wangjinchao/Library/Application Support/typora-user-images/image-20220819133034978.png)

如上所示，调用正常，拿到的原始响应报文。webservice client自行会根据wsdl文档对原始响应报文做XML->对象的处理。

# 2、http Rest Proxy

既然上述知道，是先通过获取wsdl文档完成后续的传输文本编解码，那么应该也可以搭一个http代理，在代理内部完成编解码的任务，支持外部json数据，或者xml原始数据，通过这个http代理server都能成功请求soap server。

## 2.1、实现逻辑

我们选择在http server内部构建soap client对象，对外选择屏蔽wsdl，需要一个配置文件，来管理多个soap server，配置文件的结构如下：

```json
{
  "userManager": {
    "server": "http://localhost:9000/HelloWorld"
  }
}
```

http client发起请求时，URL结构上一级path代表userManager`，锁定需要访问的哪个soap server，二级path代表`method`，调用指定soap server的哪个函数名。

## 2.2、http server

如下代码，思路应该比较简洁，

1. 启动入口为start，先初始化soap配置文件，再开启http服务，监听请求；
2. 初始化soapClient，遍历config配置，依次初始化后存入到soapCache对象中；
3. 开启http服务，并监听请求事件，请求触发时，如果soapConfig为空，就返回500；
4. 获取请求的pathname，按/分割，要求必须`/${userManager}/${methodName}`，结尾不能带/，否则依次返回500&错误信息；
5. 从请求中读取请求报文；
6. 拿到报文body 和 二级path的methodName，根据一级path筛选的soap对象，去调用soap服务；
7. 做出http响应，200 & 500，正常报文 & error info

```js
/**
 * create by ikejcwang on 2022.03.07.
 * 注：这只是一个demo，没有适配高并发，如果想要引用的话，可以根据nodejs多进程实现方案来具体改造。
 */
'use strict';
const http = require('http');
const nodeUtil = require('util');
const URL = require('url');
const SoapClient = require('./SoapClient');
const settings = require('./settings').settings;
const configs = require('./settings').configs;
let soapCache = {}

start();

/**
 * 启动入口
 */
function start() {
    initSoapConfig();
    startHttpServer();
}

/**
 * 初始化Soap配置
 */
function initSoapConfig() {
    if (configs && Object.keys(configs).length > 0) {
        for (let key in configs) {
            soapCache[key] = new SoapClient(configs[key]);
        }
    }
}

/**
 * 启动http服务
 */
function startHttpServer() {
    let server = http.createServer();
    server.on('request', listenRequestEvent);
    server.on('close', () => {
        console.log('http Server has Stopped At:' + settings['bindPort'])
    });
    server.on('error', err => {
        console.log('http Server error:' + err.toString());
        setTimeout(() => {
            process.exit(1);
        }, 3000);
    });
    server.listen(settings['bindPort'], settings['bindIP'], settings['backlog'] || 8191, () => {
        console.log('Started Http Server At: ' + settings['bindIP'] + ':' + settings['bindPort'])
    })
}

/**
 * 监听request事件
 * @param request
 * @param response
 */
async function listenRequestEvent(request, response) {
    request.on('aborted', () => {
        console.error('aborted: client request aborted')
    });
    request.on('finish', () => {
        console.log('request has finished');
    })
    request.on('error', (err) => {
        console.log(`error event: ${nodeUtil.inspect(err)}`)
    })
    try {
        if (!configs || Object.keys(configs).length < 1) {
            response.statusCode = 500;
            response.setHeader('content-type', 'text/plain; charset=utf-8');
            response.end('No Soap Config');
            return;
        }
        let sourceUrl = URL.parse(request.url, true);
        let pathArr = sourceUrl.pathname.split('/').splice(1);
        if (pathArr.length < 2 || !pathArr[pathArr.length - 1]) {
            response.statusCode = 500;
            response.setHeader('content-type', 'text/plain; charset=utf-8');
            response.end('Unable to resolve soapMethod from pathname');
            return;
        }

        let soapConfigName = pathArr.splice(0, pathArr.length - 1).join('/');
        let soapMethod = pathArr[pathArr.length - 1];
        let soapObj = soapCache[soapConfigName];
        if (!soapObj) {
            response.statusCode = 500;
            response.setHeader('content-type', 'text/plain; charset=utf-8');
            response.end(`Unable to resolve ${soapConfigName} from config`);
            return;
        }
        let bodyChunk = [];
        request.on('data', chunk => {
            bodyChunk.push(chunk);
        });
        request.on('end', () => {
            let body = JSON.parse(bodyChunk.toString());
            try {
                soapObj.request(body, soapMethod).then(resBody => {
                    request.resBody_len = JSON.stringify(resBody).length;
                    request.duration = Date.now() - request.startTime;
                    response.statusCode = 200;
                    response.setHeader('content-type', 'application/json; charset=utf-8');
                    response.end(Buffer.from(JSON.stringify(resBody)));
                }).catch(err => {
                    request.errMsg = err.toString();
                    request.duration = Date.now() - request.startTime;
                    response.statusCode = 500;
                    response.setHeader('content-type', 'text/html; charset=utf-8');
                    response.end(Buffer.from(err.toString()));
                });

            } catch (e) {
                request.errMsg = e.toString();
                response.statusCode = 500;
                response.setHeader('content-type', 'text/html; charset=utf-8');
                response.end(Buffer.from(e.toString()));
            }
        });
    } catch (e) {
        console.log(`request_error: ${nodeUtil.inspect(e)}`);
        response.statusCode = 502;
        response.end('ike httpToSoap proxy error');
    }
}
```

## 2.3、soapClient

发现一个`soap`的npm包，自动实现了编解码的各种任务，这里在它的基础之上再简单封装一层。

1. start启动时，根据遍历的config配置文件依次完成SoapClient的初始化；
2. 调用时，按需传递body和method，完成最终调用，给出响应即可；
3. rawResponse，rawRequest都是原始的XML结构报文，可以自行拆解debug查看；

```js
/**
 * create by ikejcwang on 2022.03.07.
 */
'use strict';
const soap = require('soap');
const soapOptions = {
    disableCache: true,
    escapeXML: false
}

/**
 * 构造自定义的soap类
 */
class SoapClient {

    constructor(config) {
        this.server = config.server;
        this.init()
    }

    init() {
        soap.createClientAsync(`${this.server}?wsdl`, soapOptions).then(client => {
            this.client = client
        }).catch(err => {
            this.err = err
        })
    }

    request(body, method) {
        return new Promise((resolve, reject) => {
            if (this.err) {
                reject(this.err)
            } else {
                if (!this.client[method]) {
                    reject(new Error('soap client does not support this method: ${method}'))
                } else {
                    this.client[method](body, (err, result, rawResponse, soapHeader, rawRequest) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(result)
                        }
                    })
                }
            }
        })
    }
}

module.exports = SoapClient
```

## 2.4、调试

启动start.js，

```shell
wangjinchao@IKEJCWANG-MB0 ike_httpToSoap % curl http://127.0.0.1:8080/userManager/sayHelloWorldFrom -H "Content-Type:application/json" -d '{"arg0":"ikejcwang"}'
{"return":"Hello, world, from ikejcwang"}
```

其余函数的请求一样，http请求报文body就是对应函数参数的json数据，响应报文就是对应函数返回值的json数据。此处是一个简单的demo，只提供了一个基本数据类型参数。

## 2.5、结尾

原本RPC模式隐藏掉了网络传输的细节，是很少涉及黑白名单与签名鉴权之类的操作，因为server与client必须要约定好才能发起调用，即client必须是server认可的，否则，连server长什么模样都不知道。

但有了http server这层代理，我们就可以在请求soap服务的时候基于http server上面做类似的操作了，限流策略，防刷手段……只要是http链路可以实现的都支持。

（作者对于webservice不太熟，没有实际项目使用经验，只是现今有需要针对webservice的请求做协议转换的操作，才去看了下文档后，略知一二了）
