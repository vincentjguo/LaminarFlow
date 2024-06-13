import {
  WebsocketClient,
  WebsocketResponse,
  WebsocketStatus,
} from '../websocket-client/websocket';

let client: WebsocketClient | null = null;

let connection_pending: Promise<WebsocketResponse> | null = null;

async function beginLogin([username, password, remember_me, server]:
                            [string, string, boolean, string]): Promise<WebsocketResponse> {
  client = new WebsocketClient(server);
  connection_pending = client.login(username, password, remember_me).then(response => {
    connection_pending = null;
    return response;
  }).catch(e => {
    return e;
  });
  return await connection_pending;
}

async function beginReconnect([token, server]: [string, string]) {
  client = new WebsocketClient(server);
  connection_pending = client.reconnect(token).then(response => {
    connection_pending = null;
    return response;
  }).catch(e => {
    return e;
  });
  return await connection_pending;
}


// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   if (changeInfo.status === 'loading' && tab.url!.includes("uwflow.com")) {
//     let id = chrome.runtime.id
//     let inFunc = () => {const extensionId = id}
//
//     chrome.scripting.executeScript({
//       target: { tabId: tabId },
//       function: inFunc
//     }).then();
//   }
// });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // content script flows
  if (request.type === "inject") {
    console.log("Received inject request")
    chrome.scripting.executeScript({
      target: { tabId: sender.tab!.id! },
      files: [request.data],
      world: "MAIN"
    }).then();
    return false;
  }
  else if (request.type === "status") {
    console.log("Received status request")
    sendResponse(!!client && client.status());
    return true
  }

  // login flows (should only be called by internal extension)
  if (request.type === "login") {
    console.log("Received login request")
    if (connection_pending) {
      console.log("Connection already in progress")
      connection_pending.then((r) => sendResponse(r));
    }
    else if (client?.status()) {
      console.log("Client already exists")
      sendResponse({
        status: WebsocketStatus.SUCCESS,
        payload: 'Client already exists',
      });
    } else beginLogin(request.data).then((r) => sendResponse(r));
    return true;
  }
  else if (request.type === "reconnect") {
    console.log("Received reconnect request")
    if (connection_pending) {
      console.log("Connection already in progress")
      connection_pending.then((r) => sendResponse(r));
    }
    else if (client?.status()) {
      console.log("Client already exists")
      sendResponse({
        status: WebsocketStatus.SUCCESS,
        payload: 'Client already exists',
      });
    } else
      beginReconnect(request.data).then(r => sendResponse(r))
    return true
  }
  else if (request.type === "check_existing_login") {
    console.log("Received check existing login connection request");
    if (!connection_pending) sendResponse(false)
    else connection_pending.then((r) => sendResponse(r));
    return true
  }

  // operation flows (following operations require client to exist)
  if (!client?.status()) {
    console.log("Client does not exist")
    sendResponse({
      status: WebsocketStatus.ERROR,
      payload: 'Client does not exist',
    });
    return true;
  }
  if (request.type === "receive") {
    console.log("Received receive request");
    client!.receive().then(r => sendResponse(r));
    return true;
  }
  else if (request.type === "logout") {
    console.log("Received logout request");
    client!.signout();
    client = null;
    return false;
  }
  else if (request.type === "search") {
    console.log("Received search request");
    client!.search_classes(request.data[0], request.data[1], request.data[2])
      .then(r => sendResponse(r));
    return true;
  }
})

// chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
//
// })

chrome.runtime.onStartup.addListener(async () => {
  console.log("Service worker starting up...")
  let token = (await chrome.storage.local.get({ access_token: '' })).access_token
  console.log("Existing Token: ", token)
  let username = (await chrome.storage.local.get({ questAPI_username: '' })).questAPI_username
  console.log("Existing Username: ", username)
  let server_url = (await chrome.storage.local.get({ questAPI_url: '' })).questAPI_url
  console.log("Existing Server URL: ", server_url)

  beginReconnect([token, server_url]).then()
})

chrome.runtime.onSuspend.addListener(() => {
  if (client) {
    console.log("Service worker suspending. Closing client...")
    client.quit()
  }
})





