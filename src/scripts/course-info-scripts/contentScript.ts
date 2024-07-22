import { CourseModel, SectionModel } from "./courseModel";
import { WebsocketResponse, WebsocketStatus } from "../../websocket-client/websocket";
import { LFEventID, Message } from "./common";

console.debug('Interceptor loaded!');

const originalFetch = window.fetch;


function getValidSections(data: SectionModel[]) {
  let termSections = new Map<number, number[]>();
  for (let i = 0; i < data.length; i++) {
    const section = data[i];
    if (section.term_id) {
      console.debug("Found valid section: ", section);
      if (!termSections.has(section.term_id))
        termSections.set(section.term_id, []);

      termSections.get(section.term_id)?.push(i);
    }
  }
  console.info("Found ", termSections.size, " valid sections");
  console.debug("Valid sections: ", termSections);
  return termSections;
}

function profNameToCode(profName: string): string {
  console.debug("Converting prof name to code: ", profName)
  let s = "";
  let lastIsLetter = true;
  profName = profName.toLowerCase();
  for (let i = 0; i < profName.length; i++) {
    if (97 <= profName.charCodeAt(i) && profName.charCodeAt(i) <= 122) {
      s += profName[i];
      lastIsLetter = true;
      // Everything else is dropped
    } else {
      s += "_";
      lastIsLetter = false;
    }
  }
  // If last symbol was not a letter,
  // then we have appended an extra _ at the end.
  // Return constructed string without that underscore.
  if (!lastIsLetter) {
    return s.slice(0, s.length - 1);
  }
  return s;
}

async function queryProfID(profCode: string): Promise<number> {
  console.log("Querying prof ID for: ", profCode);
  let response = await fetch("https://uwflow.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query:
        "query Prof {\n" +
        `    prof(where: { code: { _eq: "${profCode}" } }) {` +
        "        id\n" +
        "    }\n" +
        "}"
    })
  });

  let data = await response.json();
  console.debug("Prof query response: ", data);
  if (!data.data.prof.length)
    return 0;
  return data.data.prof[0].id;
}

async function injectCourseData(data: CourseModel, payload: Map<string, string[]>, valid_sections: number[]): Promise<CourseModel> {
  for (let i of valid_sections) {
    const section_name = data.sections[i].section_name;
    console.log("Injecting data for section: ", section_name);
    if (payload.has(section_name)) {
      let section_data = payload.get(section_name)!;
      data.sections[i].meetings[0].location = section_data[0];
      let prof_code = profNameToCode(section_data[1]);
      let prof_id = await queryProfID(prof_code);
      console.debug("Modifying ", section_name, " with location: ", section_data[0], " and prof: ", section_data[1]);
      data.sections[i].meetings[0].prof = {
        id: prof_id,
        code: prof_code,
        name: section_data[1],
        __typename: "prof"
      };
    }
  }

  return data;
}

function postWindowMsgWithResponse(msg: { type: string, data: any }): Promise<WebsocketResponse> {
  return new Promise((resolve) => {
    let message: Message = { type: msg.type, data: msg.data, eventID: LFEventID };
    console.debug("Posting window message: ", message);
    window.postMessage(message, "*");
    window.onmessage = (event: MessageEvent<Message>) => {
      if (event.data.eventID === LFEventID && event.data.type === 'response') {
        resolve(event.data.data);
      }
    };
  });
}

window.fetch = async function (
  input: RequestInfo | URL,
  init?: RequestInit
) {
  // We cannot call chrome API directly from fetch override, so we first post to window context

  if (
    typeof input === 'string' &&
    input.includes('/graphql') &&
    init &&
    init.method === 'POST'
  ) {
    // Modify the request body as needed
    if (init.body) {
      const bodyData = JSON.parse(init.body.toString());
      // Modify the bodyData as needed
      if (bodyData.operationName !== 'getCourse') {
        console.debug('Not a course query. Skipping...');
        return originalFetch(input, init);
      }
    } else return originalFetch(input, init);

    if (!(await postWindowMsgWithResponse({ type: 'status', data: '' }))) {
      console.warn('Not authenticated. Ignoring...');
      return originalFetch(input, init);
    }

    init.headers = {
      ...init.headers,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }; // disable caching so future requests are still intercepted



    const response = await originalFetch(input, init);
    console.debug('Intercepted response: ', response);
    if (!response.ok) return response;
    const clone = await response.json();

    try {
      console.debug(clone.data.course[0]);
      let data: CourseModel = <CourseModel>clone.data.course[0];

      // Parse course information
      let termSections = getValidSections(data.sections);

      // split the course code
      let index = data.code.search(/\d/);
      let course_name = data.code.slice(0, index).toUpperCase();
      let course_code = data.code.slice(index);
      console.debug('Course name: ', course_name, ' | Course code: ', course_code);

      // Begin search
      for (let [term_id, valid_sections] of Array.from(termSections)) {
        console.info('Searching for term: ', term_id, ' for sections: ', valid_sections);
        let search_response: WebsocketResponse =
          await postWindowMsgWithResponse({
            type: 'search',
            data: [term_id, course_name, course_code],
          }).catch(() => {
            console.error('Search failed for term: ', term_id);
            return new WebsocketResponse(
              WebsocketStatus.ERROR,
              'Search failed'
            );
          });

        console.debug('Search response: ', search_response);

        if (search_response.status == WebsocketStatus.SUCCESS) {
          console.log('Search success for term: ', term_id);
          let payload: Map<string, string[]> = new Map(
            Object.entries(
              JSON.parse(search_response.payload.replace(/'/g, '"'))
            )
          );
          data = await injectCourseData(data, payload, valid_sections);
        }
      }
      const injectedJson = {
        data: {
          course: [data]
        }
      }

      // Create a new response with the modified data
      const injectedResponse = new Response(
        new Blob([JSON.stringify(injectedJson)], {
        type: 'application/json',
      }),
       {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers({
          ...response.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        })
      })
      console.debug('Injected json: ', injectedJson);

      return injectedResponse

    } catch (e) {
      console.error(e);
      return new Response(
        new Blob([clone], {
          type: 'application/json',
        }),
        {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
    }
  }
  return originalFetch(input, init);
}

