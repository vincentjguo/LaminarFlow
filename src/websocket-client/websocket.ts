

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
  private ws_url: string;
  private socket: WebSocket | undefined;
  private lock: Promise<void> = Promise.resolve();

  private sessionCounter: number = 0;
  private loggedIn: boolean = false;
  private token: string = '';

  constructor(ws_url: string) {
    this.ws_url = ws_url;
  }

  status(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  /**
   * Begins websocket login flow. If DUO auth is required, consumer must call receive() to accept token after auth.
   * @param username
   * @param password
   * @param remember_me
   */
  async login(
    username: string,
    password: string,
    remember_me: boolean
  ): Promise<WebsocketResponse> {
    try {
      this.socket = new WebSocket(`wss://${this.ws_url}/login`);
      await this.wait_for_open().catch(() => {
        throw {
          status: WebsocketStatus.ERROR,
          message: 'Cannot connect to server',
        };
      });
      this.socket.send(username);
      this.socket.send(password);
      this.socket.send(remember_me.toString());

      return this.receive()
        .then((response) => {
          if (response.status === WebsocketStatus.SUCCESS) {
            this.checkIdle();
            this.token = response.payload;
            this.loggedIn = true;
          }
          return response;
        })
        .catch(() => {
          throw { status: WebsocketStatus.CLOSED, message: 'Login Failed' };
        });
    } catch (e: WebsocketResponse | any) {
      this.loggedIn = false;
      this.socket = undefined;
      return e;
    }
  }

  async reconnect(token: string): Promise<WebsocketResponse> {
    try {
      this.socket = new WebSocket(`wss://${this.ws_url}/reconnect`);
      await this.wait_for_open().catch(() => {
        throw {
          status: WebsocketStatus.ERROR,
          message: 'Cannot connect to server',
        };
      });
      this.socket.send(token);
      return this.receive()
        .then((response) => {
          this.loggedIn = response.status === WebsocketStatus.SUCCESS;
          this.checkIdle();
          return response;
        })
        .catch(() => {
          this.loggedIn = false;
          throw {
            status: WebsocketStatus.CLOSED,
            message: 'Reauthentication needed',
          };
        });
    } catch (e: WebsocketResponse | any) {
      this.loggedIn = false;
      this.socket = undefined;
      return e;
    }
  }

  async duo_auth_receive(): Promise<WebsocketResponse> {
    let response = await this.receive();
    this.token = response.payload;
    this.loggedIn = true;
    this.checkIdle();
    return response;
  }

  async wait_for_open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket!.onopen = (event) => {
        console.log('WebSocket opened: ', event);

        // attach required event listeners
        this.socket!.addEventListener('close', () => {
          console.log('WebSocket closed');
          this.socket = undefined;
        });

        resolve();
      };
      this.socket!.onerror = function (event) {
        console.error('WebSocket error: ', event);
        reject();
      };
    });
  }

  async search_classes(
    term: string,
    subject: string,
    class_number: string
  ): Promise<WebsocketResponse> {
    return new Promise<WebsocketResponse>((resolve) => {
      this.lock = this.lock
        .then(async () => {
          if (!this.status()) { // sanity check
            console.warn('Cannot search with inactive connection');
            await this.reconnect(this.token);
          }

          console.log(
            'Beginning search for ' + term + ' ' + subject + ' ' + class_number
          );
          this.socket!.send('SEARCH');
          this.socket!.send(term);
          this.socket!.send(subject);
          this.socket!.send(class_number);

          return this.receive();
        })
        .then((response) => {
          console.log(response);
          resolve(response);
        })
        .catch((e: WebsocketResponse | any) => {
          console.error(e);
          resolve({ status: WebsocketStatus.ERROR, payload: 'Search failed' });
        })
        .finally(() => {
          // This delay is to ensure that the next promise in the queue doesn't start immediately.
          return new Promise((resolve) => setTimeout(resolve, 100));
        });
    });
  }

  async receive(): Promise<WebsocketResponse> {
    return new Promise((resolve, reject) => {
      this.socket!.onmessage = (event) => {
        console.log('Message from server: ', event.data);
        this.socket!.onmessage = null;
        this.socket!.onerror = null;
        this.socket!.onclose = null;
        resolve(JSON.parse(event.data));
      };
      this.socket!.onerror = (event) => {
        console.error('WebSocket error while waiting for response: ', event);
        this.socket!.onmessage = null;
        this.socket!.onerror = null;
        this.socket!.onclose = null;
        reject(WebsocketStatus.ERROR);
      };
      this.socket!.onclose = (event)=> {
        console.log('WebSocket closed while waiting for response: ', event);
        // if (event.code === 1002)
        //   this.loggedIn = false;
        reject(WebsocketStatus.CLOSED);
      };
    });
  }

  signOut() {
    if (!this.loggedIn) {
      console.warn('Cannot sign out unauthenticated user');
      return;
    }

    this.incrementSession().then(() => {
      this.socket!.send('SIGN OUT');
      this.socket!.close();
      this.socket = undefined;
      this.loggedIn = false;
    });
  }

  quit(): void {
    if (!this.status()) {
      console.warn('Cannot quit inactive connection');
      return;
    }
    this.socket!.send('QUIT');
    this.socket!.close();
    this.socket = undefined;
  }

  async incrementSession() {
    this.sessionCounter++;

    if (!this.loggedIn) return;

    if (!this.token.length)
      this.token = (await chrome.storage.local.get({access_token: ''})).access_token;
    console.log('Session count now at ', this.sessionCounter);
    if (!this.socket) await this.reconnect(this.token);
  }

  decrementSession() {
    if (!this.sessionCounter) {
      console.warn('Tried to remove nonexistent session');
      return;
    }
    this.sessionCounter--;
    console.log('Session count now at ', this.sessionCounter);
    this.checkIdle();
  }

  private checkIdle() {
    if (!this.status() || this.sessionCounter > 0) return;

    // no sessions found, close websocket
    console.log('All sessions closed. Closing connection...');
    this.quit();
  }
}