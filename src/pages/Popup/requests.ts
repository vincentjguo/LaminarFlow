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
    console.error(e)
    return 0
  }
}

export async function check_pulse(token: string) {
  const headers = {"Authorization": "Bearer " + token,
    "accept": "application/json"}

  const response = await fetch(api_url + '/pulse', { headers })
  return response.status === 200
}