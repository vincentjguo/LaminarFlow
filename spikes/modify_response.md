# What if we intercept graphql req and inject??

## Intercepting response
https://medium.com/@ddamico.125/intercepting-network-response-body-with-a-chrome-extension-b5b9f2ef9466
```js
let oldXHROpen = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function() {
  this.addEventListener("load", function() {
    const responseBody = this.responseText;
    console.log(`Response Body: {responseBody}`);
  });
  return oldXHROpen.apply(this, arguments);
};
```

## Parsing response
operationName: "getCourse"
Meeting attr for each section -> set location name
The following is the logic for prof codes required
https://github.com/UWFlow/uwflow/blob/cfd5b354cb7908f5591130d59478694e5d0ab3ad/flow/common/util/string.go#L43
```go
func ProfNameToCode(profName string) string {
    var sb strings.Builder
    var lastIsLetter bool
    
    for i := 0; i < len(profName); i++ {
        // Uppercase Latin letters are extracted and converted to lowercase
        if IsUpperCase(profName[i]) {
            sb.WriteByte(ToLowerCase(profName[i]))
            lastIsLetter = true
            // Lowercase Latin letters are extracted as-is
        } else if IsLowerCase(profName[i]) {
            sb.WriteByte(profName[i])
            lastIsLetter = true
            // Everything else is dropped
        } else if lastIsLetter {
            sb.WriteByte('_')
            lastIsLetter = false
        }
    }
    // If last symbol was not a letter,
    // then we have appended an extra _ at the end.
    // Return constructed string without that underscore.
    if sb.Len() > 0 && !lastIsLetter {
        return sb.String()[:sb.Len()-1]
    } else {
        return sb.String()
    }
}
```

## Grabbing prof ID
Request the following graphql query to `https://uwflow.com/graphql` NO AUTH
```graphql
query Prof {
    prof(where: { code: { _eq: "$prof_code" } }) {
        id
    }
}
```

## Injecting response
???