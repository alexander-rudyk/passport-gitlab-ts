import { Strategy as PassportStrategy } from 'passport-strategy';
import { Profile, StrategyOptions } from './types';
import axios from 'axios';

export class GitLabStrategy extends PassportStrategy {
  name: string;
  private baseUrl: string;
  private clientID: string;
  private clientSecret: string;
  private callbackURL: string;
  private scope: string[];

  constructor(
    options: StrategyOptions,
    private verify: (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: (error: any, user?: any) => void,
    ) => void,
  ) {
    super();
    this.name = 'gitlab';
    this.baseUrl = options.baseUrl || 'https://gitlab.com';
    this.clientID = options.clientID;
    this.clientSecret = options.clientSecret;
    this.callbackURL = options.callbackURL;
    this.scope = options.scope || ['read_user'];
  }

  authenticate(req: any) {
    const code = req.query.code;

    if (!code) {
      this.authorize();
      return;
    }

    this.getToken(code)
      .then((response) => {
        const { access_token: accessToken, refresh_token: refreshToken } =
          response.data;

        return this.getProfile(accessToken).then((profileResponse) => {
          const profile = this.parseProfile(profileResponse.data);

          this.verify(accessToken, refreshToken, profile, (error, user) => {
            if (error) return this.error(error);
            this.success(user);
          });
        });
      })
      .catch((error) => this.error(error));
  }

  private authorize() {
    const authorizationURL = `${this.baseUrl}/oauth/authorize?client_id=${this.clientID}&redirect_uri=${encodeURIComponent(
      this.callbackURL,
    )}&response_type=code&scope=${this.scope.join(' ')}`;
    this.redirect(authorizationURL);
  }

  private async getToken(code: string) {
    return axios.post(`${this.baseUrl}/oauth/token`, {
      client_id: this.clientID,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.callbackURL,
    });
  }

  private async getProfile(accessToken: string) {
    return axios.get(`${this.baseUrl}/api/v4/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  private parseProfile(data: any): Profile {
    const profile: Profile = {
      profileUrl: data.web_url,
      provider: 'gitlab',
      id: `${data.id}`,
      displayName: data.name,
      username: data.username,
      photos: [{ value: data.avatar_url }],
      emails: [{ value: data.email }],
      _json: data,
    };

    return profile;
  }
}
