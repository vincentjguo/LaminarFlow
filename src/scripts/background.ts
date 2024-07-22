import {
  WebsocketClient,
  WebsocketResponse,
  WebsocketStatus,
} from '../websocket-client/websocket';

let client: WebsocketClient | null = null;

let connectionPending: boolean = false;
let loginConnection: Promise<WebsocketResponse> | null = null;

const CACHE_LIFETIME = 1000 * 60 * 60 * 24; // 24 hours


async function beginLogin([username, password, remember_me, server]:
                            [string, string, boolean, string]): Promise<WebsocketResponse> {
  client = new WebsocketClient(server);
  connectionPending = true;
  loginConnection = client
    .login(username, password, remember_me)
    .then((response) => {
      return response;
    })
    .catch((e) => {
      return e;
    })
    .finally(() => {
      connectionPending = false;
    });
  return await loginConnection;
}

async function beginReconnect([token, server]: [string, string]) {
  client = new WebsocketClient(server);
  connectionPending = true;
  loginConnection = client.reconnect(token).then(response => {
    return response;
  }).catch(e => {
    return e;
  }).finally(() => {
    connectionPending = false;
  });
  return await loginConnection;
}

async function getCache(courseId: string): Promise<WebsocketResponse | null> {
  console.info('Checking cache for course: ', courseId);
  return await chrome.storage.local
    .get({ course_data_cache: [] })
    .then((data) => {
      console.debug('Cache data: ', data);
      for (let courseData of data.course_data_cache as [
        {
          courseId: string;
          cachedResponse: WebsocketResponse;
          cacheTime: number;
        }
      ]) {
        if (courseData.cacheTime < Date.now() - CACHE_LIFETIME) {
          data.course_data_cache.splice(
            data.course_data_cache.indexOf(courseData),
            1
          );
          console.debug('Removing stale cache for course: ', courseId);
        } else if (courseData.courseId === courseId) {
          console.info('Found cache for course: ', courseId);
          return courseData.cachedResponse;
        }
      }
      return null;
    });
}

function setCache(courseId: string, cachedResponse: WebsocketResponse) {
  console.info('Setting cache for course: ', courseId);
  chrome.storage.local.get({course_data_cache: []}).then((data) => {
    let cache = data.course_data_cache;
    cache.push({
      courseId: courseId,
      cachedResponse: cachedResponse,
      cacheTime: Date.now()
    });
    console.debug(cache);
    void chrome.storage.local.set({ course_data_cache: cache });
  });
}


const tabUrls: { [id: number] : string} = {};

chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
  if (tab.url?.includes('uwflow.com') && !(tabId in tabUrls)) {
    tabUrls[tabId] = tab.url;
    console.log(`Tab with ID ${tabId} is visiting uwflow.com`);
    if (client) void client.incrementSession();
  }
  if (!tab.url?.includes('uwflow.com') && tabId in tabUrls) {
    delete tabUrls[tabId];
    if (client) client.decrementSession();
  }
});

// Listen for tab removals
chrome.tabs.onRemoved.addListener((tabId) => {
  // Check if the closed tab was visiting uwflow.com
  if (tabId in tabUrls) {
    console.log(`Tab with ID ${tabId} that was visiting uwflow.com has been closed`);
    if (client) client.decrementSession();
    delete tabUrls[tabId];
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // content script flows
  if (request.type === "inject") {
    console.log("Received inject request")
    void chrome.scripting.executeScript({
      target: { tabId: sender.tab!.id! },
      files: [request.data],
      world: "MAIN"
    });
    return false;
  }
  else if (request.type === "status") {
    console.log("Received status request")
    console.debug("Client ready state", !!client && client.isLoggedIn());
    sendResponse(!!client && client.isLoggedIn());
    return true
  }

  // login flows (should only be called by internal extension)
  if (request.type === "login") {
    console.log("Received login request")
    if (connectionPending) {
      console.log("Connection already in progress")
      console.debug(connectionPending)
      loginConnection!
        .then((r) => sendResponse(r));
    }
    else if (client && client?.status()) {
      console.log("Client already exists")
      sendResponse({
        status: WebsocketStatus.SUCCESS,
        payload: 'Client already exists',
      });
    } else beginLogin(request.data)
      .then((r) => sendResponse(r));
    return true;
  }
  else if (request.type === "reconnect") {
    console.log("Received reconnect request")
    if (connectionPending) {
      console.log("Connection already in progress")
      console.debug(loginConnection);
      loginConnection!
        .then((r) => sendResponse(r));
    }
    else if (client && client?.status()) {
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
    console.debug("Connection pending: ", connectionPending)
    console.debug(loginConnection);
    if (!connectionPending) sendResponse(false)
    else loginConnection!.then((r) => sendResponse(r));
    return true
  }
  else if (request.type === "check_logged_in") {
    if (!client) {
      console.log("Client does not exist")
      sendResponse(false);
    }
    else sendResponse(client.isLoggedIn());
  }
  else if (request.type === "duo_auth") {
    console.log("Received duo auth request");
    connectionPending = true;
    client!.duo_auth_receive().then((r) => sendResponse(r))
      .catch((e) => sendResponse(e))
      .finally(() => (connectionPending = false));

    return true;
  }

  // operation flows (following operations require client to exist)
  if (!client?.isLoggedIn()) {
    console.log("Client is not logged in")
    sendResponse({
      status: WebsocketStatus.ERROR,
      payload: 'Client is not logged in',
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
    client!.signOut();
    client = null;
    return false;
  }
  else if (request.type === "search") {
    console.log("Received search request");
    getCache(request.data[0] + request.data[1] + request.data[2]).then((response) => {
      console.debug("Cache response: ", response);
      if (response) // check cache
        sendResponse(response);
      else client! // cache miss
        .search_classes(request.data[0], request.data[1], request.data[2])
        .then((r) => {
          sendResponse(r);
          if (r.status === WebsocketStatus.SUCCESS)
            setCache(request.data[0] + request.data[1] + request.data[2], r);
        });
    });
    return true;
  }
})



chrome.runtime.onStartup.addListener(async () => {
  console.log("Service worker starting up...")
  let token = (await chrome.storage.local.get({ access_token: '' })).access_token
  console.log("Existing Token: ", token)
  let username = (await chrome.storage.local.get({ questAPI_username: '' })).questAPI_username
  console.log("Existing Username: ", username)
  let server_url = (await chrome.storage.local.get({ questAPI_url: '' })).questAPI_url
  console.log("Existing Server URL: ", server_url)

  void beginReconnect([token, server_url]);
})

chrome.runtime.onSuspend.addListener(() => {
  if (client) {
    console.log("Service worker suspending. Closing client...")
    client.quit()
  }
})





