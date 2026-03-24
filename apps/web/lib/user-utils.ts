export interface User {
  id: string
  name: string
  email: string
  updatedAt: number
}

export function updateUser(user: User, name: string): User {
  return {
    ...user,
    name,
    updatedAt: Date.now(),
  }
}
