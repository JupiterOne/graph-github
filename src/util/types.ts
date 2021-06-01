export interface JsonWebToken {
  exp: number;
  iat: number;
  iss: any;
}

export interface SignedJsonWebToken extends JsonWebToken {
  token: string;
}
