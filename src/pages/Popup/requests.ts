let api_url: string;

export function set_api_url(url: string) {
  api_url = url
}

export async function authenticate(username: string, password: string) {
  return await fetch(api_url + '/authenticate', {
    method: 'POST',
    body: `grant_type=&username=${username}&password=${password}&scope=remember_me&client_id=&client_secret=`,
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

export async function search_classes(term: string, subject: string, class_number: string, token: string) {
  const url = api_url + "/search/" + term + "&" + subject + "&" + class_number
  const headers = {"Authorization": "Bearer " + token,
                                        "accept": "application/json"}
  try {
    return await fetch(url, { headers })
  }
  catch (e) {
    return 0
  }
}