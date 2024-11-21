import { GitLabStrategy } from './strategy';
import axios from 'axios';
import { mocked } from 'jest-mock';

jest.mock('axios');
const mockedAxios = mocked(axios, { shallow: false });

describe('GitLabStrategy', () => {
  const mockVerify = jest.fn();
  const strategyOptions = {
    clientID: 'test-client-id',
    clientSecret: 'test-client-secret',
    callbackURL: 'http://localhost/callback',
    baseUrl: 'https://gitlab.com',
  };

  let strategy: GitLabStrategy;

  beforeEach(() => {
    strategy = new GitLabStrategy(strategyOptions, mockVerify);
    jest.clearAllMocks();
  });

  it('should redirect to GitLab authorization URL if no code is provided', () => {
    const mockReq = { query: {} };
    const mockRedirect = jest.fn();
    (strategy as any).redirect = mockRedirect;

    strategy.authenticate(mockReq);

    expect(mockRedirect).toHaveBeenCalledWith(
      `https://gitlab.com/oauth/authorize?client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback&response_type=code&scope=read_user`,
    );
  });

  it('should handle authentication flow with a valid code', async () => {
    const mockReq = { query: { code: 'test-code' } };
    const mockAccessToken = 'test-access-token';
    const mockRefreshToken = 'test-refresh-token';
    const mockProfileData = {
      id: 123,
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'http://example.com/avatar.png',
      web_url: 'http://example.com/profile',
    };

    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: mockAccessToken, refresh_token: mockRefreshToken },
    });
    mockedAxios.get.mockResolvedValueOnce({ data: mockProfileData });

    strategy.authenticate(mockReq);

    await new Promise(setImmediate);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://gitlab.com/oauth/token',
      {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        code: 'test-code',
        grant_type: 'authorization_code',
        redirect_uri: 'http://localhost/callback',
      },
    );

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://gitlab.com/api/v4/user',
      {
        headers: { Authorization: `Bearer ${mockAccessToken}` },
      },
    );

    expect(mockVerify).toHaveBeenCalledWith(
      mockAccessToken,
      mockRefreshToken,
      {
        id: '123',
        username: 'testuser',
        displayName: 'Test User',
        emails: [{ value: 'test@example.com' }],
        photos: [{ value: 'http://example.com/avatar.png' }],
        profileUrl: 'http://example.com/profile',
        provider: 'gitlab',
        _json: mockProfileData,
      },
      expect.any(Function),
    );
  });

  it('should handle errors during token exchange', async () => {
    const mockReq = { query: { code: 'test-code' } };
    const mockError = new Error('Token exchange failed');
    const mockErrorHandler = jest.fn();
    (strategy as any).error = mockErrorHandler;

    mockedAxios.post.mockRejectedValueOnce(mockError);

    strategy.authenticate(mockReq);

    await new Promise(setImmediate);

    expect(mockErrorHandler).toHaveBeenCalledWith(mockError);
  });

  it('should handle errors during profile fetching', async () => {
    const mockReq = { query: { code: 'test-code' } };
    const mockError = new Error('Profile fetch failed');
    const mockErrorHandler = jest.fn();
    const mockAccessToken = 'test-access-token';

    (strategy as any).error = mockErrorHandler;

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: mockAccessToken,
        refresh_token: 'test-refresh-token',
      },
    });
    mockedAxios.get.mockRejectedValueOnce(mockError);

    strategy.authenticate(mockReq);

    await new Promise(setImmediate);

    expect(mockErrorHandler).toHaveBeenCalledWith(mockError);
  });
});
