import axios from 'axios';
import { mocked } from 'jest-mock';
import * as libraryExports from './index';
import { GitLabStrategy } from './strategy';

jest.mock('axios');
const mockedAxios = mocked(axios, { shallow: false });

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('GitLabStrategy', () => {
  const mockVerify = jest.fn();
  const strategyOptions = {
    clientID: 'test-client-id',
    clientSecret: 'test-client-secret',
    callbackURL: 'http://localhost/callback',
    baseUrl: 'https://gitlab.com',
  };

  const mockProfileData = {
    id: 123,
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    avatar_url: 'http://example.com/avatar.png',
    web_url: 'http://example.com/profile',
  };

  let strategy: GitLabStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new GitLabStrategy(strategyOptions, mockVerify);
  });

  it('re-exports the strategy from the package entrypoint', () => {
    expect(libraryExports.GitLabStrategy).toBe(GitLabStrategy);
  });

  it('redirects to GitLab authorization URL if no code is provided', () => {
    const mockReq = { query: {} };
    const mockRedirect = jest.fn();
    (strategy as any).redirect = mockRedirect;

    strategy.authenticate(mockReq);

    expect(mockRedirect).toHaveBeenCalledWith(
      'https://gitlab.com/oauth/authorize?client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback&response_type=code&scope=read_user',
    );
  });

  it('uses default baseUrl and scope when they are omitted', () => {
    const defaultStrategy = new GitLabStrategy(
      {
        clientID: 'default-client-id',
        clientSecret: 'default-client-secret',
        callbackURL: 'http://localhost/default-callback',
      },
      mockVerify,
    );
    const mockRedirect = jest.fn();

    (defaultStrategy as any).redirect = mockRedirect;

    defaultStrategy.authenticate({ query: {} });

    expect(mockRedirect).toHaveBeenCalledWith(
      'https://gitlab.com/oauth/authorize?client_id=default-client-id&redirect_uri=http%3A%2F%2Flocalhost%2Fdefault-callback&response_type=code&scope=read_user',
    );
  });

  it('joins multiple scopes in the authorization URL', () => {
    const scopedStrategy = new GitLabStrategy(
      {
        ...strategyOptions,
        scope: ['read_user', 'read_api'],
      },
      mockVerify,
    );
    const mockRedirect = jest.fn();

    (scopedStrategy as any).redirect = mockRedirect;

    scopedStrategy.authenticate({ query: {} });

    expect(mockRedirect).toHaveBeenCalledWith(
      'https://gitlab.com/oauth/authorize?client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback&response_type=code&scope=read_user read_api',
    );
  });

  it('handles authentication flow with a valid code', async () => {
    const mockReq = { query: { code: 'test-code' } };
    const mockAccessToken = 'test-access-token';
    const mockRefreshToken = 'test-refresh-token';

    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: mockAccessToken, refresh_token: mockRefreshToken },
    });
    mockedAxios.get.mockResolvedValueOnce({ data: mockProfileData });

    strategy.authenticate(mockReq);

    await flushPromises();

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

  it('calls success with the verified user', async () => {
    const mockReq = { query: { code: 'test-code' } };
    const verifiedUser = { id: 'user-1' };
    const mockSuccess = jest.fn();

    (strategy as any).success = mockSuccess;
    mockVerify.mockImplementationOnce((_accessToken, _refreshToken, _profile, done) =>
      done(null, verifiedUser),
    );
    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: 'test-access-token', refresh_token: 'test-refresh-token' },
    });
    mockedAxios.get.mockResolvedValueOnce({ data: mockProfileData });

    strategy.authenticate(mockReq);

    await flushPromises();

    expect(mockSuccess).toHaveBeenCalledWith(verifiedUser);
  });

  it('passes verify callback errors to passport', async () => {
    const mockReq = { query: { code: 'test-code' } };
    const verifyError = new Error('Verify failed');
    const mockErrorHandler = jest.fn();

    (strategy as any).error = mockErrorHandler;
    mockVerify.mockImplementationOnce((_accessToken, _refreshToken, _profile, done) =>
      done(verifyError),
    );
    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: 'test-access-token', refresh_token: 'test-refresh-token' },
    });
    mockedAxios.get.mockResolvedValueOnce({ data: mockProfileData });

    strategy.authenticate(mockReq);

    await flushPromises();

    expect(mockErrorHandler).toHaveBeenCalledWith(verifyError);
  });

  it('handles errors during token exchange', async () => {
    const mockReq = { query: { code: 'test-code' } };
    const mockError = new Error('Token exchange failed');
    const mockErrorHandler = jest.fn();
    (strategy as any).error = mockErrorHandler;

    mockedAxios.post.mockRejectedValueOnce(mockError);

    strategy.authenticate(mockReq);

    await flushPromises();

    expect(mockErrorHandler).toHaveBeenCalledWith(mockError);
  });

  it('handles errors during profile fetching', async () => {
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

    await flushPromises();

    expect(mockErrorHandler).toHaveBeenCalledWith(mockError);
  });
});
