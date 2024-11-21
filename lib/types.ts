import { Profile as PassportProfile } from 'passport';

export interface StrategyOptions {
  baseUrl?: string;
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope?: string[];
}

export interface Profile extends PassportProfile {
  profileUrl: string;
  _json: any;
}
