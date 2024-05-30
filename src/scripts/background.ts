import { WebsocketClient, WebsocketResponse, WebsocketStatus } from "../websocket-client/websocket";

let client: WebsocketClient | null = null;

async function beginLogin([username, password, remember_me, server]:
                            [string, string, boolean, string]): Promise<WebsocketResponse> {
  client = new WebsocketClient(server)
  return await client.login(username, password, remember_me).then(response => {
    return response;
  }).catch(e => {
    return e
  })
}

async function beginReconnect([token, server]: [string, string]) {
  client = new WebsocketClient(server)
  return await client.reconnect(token).then(response => {
    return response;
  }).catch(e => {
    return e
  })
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "login") {
    console.log("Received login request")
    if (client) {
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
    if (client) {
      console.log("Client already exists")
      sendResponse({
        status: WebsocketStatus.SUCCESS,
        payload: 'Client already exists',
      });
    } else
        beginReconnect(request.data).then(r => sendResponse(r))
    return true
  }
  if (!client) {
    console.log("Client does not exist")
    sendResponse({
      status: WebsocketStatus.ERROR,
      payload: 'Client does not exist',
    });
    return true;
  }
  if (request.type === "receive") {
    console.log("Received receive request")
    client!.receive().then(r => sendResponse(r))
    return true
  }
  else if (request.type === "logout") {
    console.log("Received logout request")
    client!.signout()
    client = null
    return false
  }
  else if (request.type === "search") {
    console.log("Received search request")
    client!.search_classes(request.data[0], request.data[1], request.data[2])
      .then(r => sendResponse(r))
    return true
  }
})

chrome.runtime.onSuspend.addListener(() => {
  if (client) {
    console.log("Service worker suspending. Closing client...")
    client.quit()
    client = null
  }
})

function parseCourseData(requestDetails: chrome.webRequest.WebResponseCacheDetails) {
  console.log("Detected response from course data")
}

chrome.webRequest.onResponseStarted.addListener(parseCourseData,
  { urls: ["https://uwflow.com/graphql"]})

// https://medium.com/@ddamico.125/intercepting-network-response-body-with-a-chrome-extension-b5b9f2ef9466
// let oldXHROpen = window.XMLHttpRequest.prototype.open;
// window.XMLHttpRequest.prototype.open = function() {
//   this.addEventListener("load", function() {
//     const responseBody = this.responseText;
//     console.log(`Response Body: {responseBody}`);
//   });
//   return oldXHROpen.apply(this, arguments);
// };

// TODO: What if we intercept graphql req and inject??
// operationName: "getCourse"
// Meeting attr for each section -> set location name
// The following is the logic for prof codes required
// https://github.com/UWFlow/uwflow/blob/cfd5b354cb7908f5591130d59478694e5d0ab3ad/flow/common/util/string.go#L43
// func ProfNameToCode(profName string) string {
// 	var sb strings.Builder
// 	var lastIsLetter bool
//
// 	for i := 0; i < len(profName); i++ {
// 		// Uppercase Latin letters are extracted and converted to lowercase
// 		if IsUpperCase(profName[i]) {
// 			sb.WriteByte(ToLowerCase(profName[i]))
// 			lastIsLetter = true
// 			// Lowercase Latin letters are extracted as-is
// 		} else if IsLowerCase(profName[i]) {
// 			sb.WriteByte(profName[i])
// 			lastIsLetter = true
// 			// Everything else is dropped
// 		} else if lastIsLetter {
// 			sb.WriteByte('_')
// 			lastIsLetter = false
// 		}
// 	}
// 	// If last symbol was not a letter,
// 	// then we have appended an extra _ at the end.
// 	// Return constructed string without that underscore.
// 	if sb.Len() > 0 && !lastIsLetter {
// 		return sb.String()[:sb.Len()-1]
// 	} else {
// 		return sb.String()
// 	}
// }

