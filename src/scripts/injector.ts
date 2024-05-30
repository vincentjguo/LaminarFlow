import { WebsocketStatus } from "../websocket-client/websocket";

let loader = document.createElement('div');
loader.classList.add('loader');

const termSelector = "sc-pjTqr"
const courseSelector = "sc-pktCe"

let target_cells: Map<string, Element[]> = new Map();

function beginLoad(rowGroup: Element) {
  for (let row of Array.from(rowGroup.children)) {
    let cells = row.children;
    cells[5].innerHTML = '';
    cells[5].appendChild(loader.cloneNode(true));

    cells[6].innerHTML = '';
    cells[6].appendChild(loader.cloneNode(true));

    let key = cells[0].innerHTML.match('(LEC|TUT|TST|LAB) \\d{3}')![0];
    console.debug("Section code found: " + key)

    target_cells.set(key, [cells[5], cells[6]])
  }
}

async function observeDocument(): Promise<void> {
  console.debug('Starting to observe document for initial load...');
  return new Promise<void>((resolve) => {
    new MutationObserver((mutations, observer) => {
      for(let mutation of mutations) {
        if(mutation.addedNodes.length) {
          let rowGroup = document.querySelector('[role="rowgroup"]');
          if (rowGroup) {
            console.debug('Element with role "rowgroup" found. Beginning injection...');
            beginLoad(rowGroup);
            observer.disconnect();
            resolve();
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
}


export async function beginInjection() {
  console.debug('Inject script loaded');
  // Wait for the observer to resolve before executing the following code
  await observeDocument();

  // Following code goes here
  let term = document.querySelector(`.${termSelector}`)!.textContent;
  let course = document.querySelector(`.${courseSelector}`)!.firstChild!.textContent;
  console.log(`Term: ${term}, Course: ${course}`);
  let classNumber = course!.slice(course!.length - 4).trim()
  course = course!.slice(0, course!.length - 4).trim()

  let response = await chrome.runtime.sendMessage({ type: 'search', data: [term, course, classNumber] })

  console.debug(response)

  if (response.status == WebsocketStatus.SUCCESS) {
    const data: Map<string, string[]> = new Map(Object.entries(JSON.parse(response.payload.replace(/'/g, '"'))));
    console.debug(data)
    for (let [key, section] of Array.from(data.entries())) {
      console.debug("Updated cell: " + key + " with " + section[0] + " and " + section[1])
      let cell = target_cells.get(key)!;

      let locationElement = document.createElement("div");
      locationElement.textContent = section[0]
      cell[0].innerHTML = '';
      cell[0].appendChild(locationElement);

      let instructorElement = document.createElement("div");
      instructorElement.textContent = section[1]
      cell[1].innerHTML = '';
      cell[1].appendChild(instructorElement);

      target_cells.delete(key)
    }
  }

  for (let [key, cell] of Array.from(target_cells.entries())) {
    console.log("Failed to update cell: " + key)
    let locationElement = document.createElement("div");
    locationElement.textContent = "N/A"
    cell[0].innerHTML = '';
    cell[0].appendChild(locationElement);

    let instructorElement = document.createElement("div");
    instructorElement.textContent = "N/A"
    cell[1].innerHTML = '';
    cell[1].appendChild(instructorElement);
  }

  console.log('Finished updating class information.')
};

