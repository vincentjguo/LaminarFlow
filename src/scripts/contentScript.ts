import '../assets/contentScript.css';
import { beginInjection } from "./injector";

let previousUrl = '';
const observer = new MutationObserver(function(mutations) {
  console.debug("mutation observed")
  if (location.href !== previousUrl) {
    console.debug("location changed")
    previousUrl = location.href;
    if (location.href.includes('uwflow.com/course/'))
        beginInjection().then()
  }
});
const config = { attributes: false, childList: true, subtree: false };
observer.observe(document, config);
if (location.href.includes('uwflow.com/course/'))
  beginInjection().then()