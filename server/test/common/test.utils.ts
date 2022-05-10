import axios from 'axios';

export const request = axios.create({
  baseURL: `${process.env.TEST_API_URL}`,
  responseType: 'json',
});

export function createTestClient() {}

export async function setUser(client: any, user: string | null = 'USER1') {
  // TODO
}
