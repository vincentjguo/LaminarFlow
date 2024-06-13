import { WebsocketResponse } from "../../websocket-client/websocket";


export type Message = {
  type: string;
  data: any | WebsocketResponse;
  eventID: string;
};

export const LFEventID = 'laminarFlowID';