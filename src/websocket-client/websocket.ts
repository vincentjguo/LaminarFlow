
export enum WebsocketStatus {
  CLOSED = -2,
  ERROR = -1,
  STATUS = 0,
  SUCCESS = 1,
  PARTIAL_SUCCESS = 2,
}

export class WebsocketResponse {
  status: WebsocketStatus;
  payload: string;

  constructor(status: WebsocketStatus, message: string) {
    this.status = status;
    this.payload = message;
  }
}

export class WebsocketClient {
  ws_url: string;
  socket: WebSocket | undefined;

  constructor(ws_url: string) {
    this.ws_url = ws_url;
  }

  /**
   * Begins websocket login flow. If DUO auth is required, consumer must call receive() to accept token after auth.
   * @param username
   * @param password
   * @param remember_me
   */
  async login(username: string, password: string, remember_me: boolean): Promise<WebsocketResponse> {
    try {
      this.socket = new WebSocket(`wss://${this.ws_url}/login`);
      await this.wait_for_open().catch(() => {
        throw { status: WebsocketStatus.ERROR, message: "Cannot connect to server" }
      })
      this.socket.send(username);
      this.socket.send(password);
      this.socket.send(remember_me.toString());

      return this.receive().then(response => {
        return response
      }).catch(() => {
        throw { status: WebsocketStatus.CLOSED, message: "Login Failed" }
      })
    } catch (e: WebsocketResponse | any) {
      return e
    }
  }

  async reconnect(token: string): Promise<WebsocketResponse> {
    try {
      this.socket = new WebSocket(`wss://${this.ws_url}/reconnect`);
      await this.wait_for_open().catch(() => {
        throw { status: WebsocketStatus.ERROR, message: "Cannot connect to server" }
      })
      this.socket.send(token);
      return this.receive().then(response => {
        return response
      }).catch(() => {
        throw { status: WebsocketStatus.CLOSED, message: "Reauthentication needed" }
      })
    }
    catch (e: WebsocketResponse | any) {
      return e
    }
  }

  async wait_for_open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket!.onopen = function(event) {
        console.log('WebSocket opened: ', event);
        resolve();
      }
      this.socket!.onerror = function(event) {
        console.error('WebSocket error: ', event);
        reject();
      }
    })
  }

  receive(): Promise<WebsocketResponse> {
    return new Promise((resolve, reject) => {
      this.socket!.onmessage = function(event) {
        console.log('Message from server: ', event.data);
        resolve(JSON.parse(event.data));
      };
      this.socket!.onerror = function(event) {
        console.error('WebSocket error: ', event);
        reject(WebsocketStatus.ERROR);
      }
      this.socket!.onclose = function(event) {
        console.log('WebSocket closed: ', event)
        reject(WebsocketStatus.CLOSED);
      }
    });
  }

  signout(): void {
    this.socket!.send('SIGN OUT')
    this.socket!.close()
  }
}