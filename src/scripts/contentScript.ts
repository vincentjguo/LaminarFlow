console.debug("Interceptor loaded!")

let valid_sections: number[] = []

const originalFetch = window.fetch;

// TODO: Deserialize json?? (Probably not worth the trouble unless model can be copied from src code)
//  Loop for each section and find term_id, and valid section indices
//  Refactor backend to accept term_id
//  Make websocket request (requires async)
//  Modify response and go!
function get_valid_sections(data: any) {

}

window.fetch = async (input, init) => {
  console.debug("Caught! ", input)
  if (typeof input === 'string' && input.includes('/graphql') && init && init.method === 'POST') {
    // Modify the request body as needed
    if (init.body) {
      const bodyData = JSON.parse(init.body.toString());
      // Modify the bodyData as needed
      if (bodyData.operationName !== 'getCourse') {
        console.debug("Not a course query. Skipping...")
        return originalFetch(input, init);
      }
    }

    const response = await originalFetch(input, init);
    console.debug("Intercepted response: ", response)
    if (response.ok) {
      const clone = await response.json();
      const data = clone.data

      get_valid_sections(data)

      // Modify the response data as needed
      data.data.course[0].name = 'Modified Course Name';
      // Create a new response with the modified data
      const blob = new Blob([JSON.stringify(data)], {
        type: 'application/json',
      });
      console.debug("Caught + Injected! ", data)
      return new Response(blob);
    }
  }
  return originalFetch(input, init);
};