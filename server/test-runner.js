const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

const runTests = async () => {
  try {
    console.log('--- STARTING TESTS ---');
    
    // 1. Fetch skills
    const { data: skills } = await axios.get(`${API_URL}/skills`);
    const react = skills.find(s => s.name === 'React');
    const nodejs = skills.find(s => s.name === 'Node.js');
    console.log('[OK] Fetched skills');

    // 2. User A Signup & Add Skills
    const axiosA = axios.create({ baseURL: API_URL, withCredentials: true });
    let cookieA = '';
    axiosA.interceptors.response.use(res => {
      if (res.headers['set-cookie']) cookieA = res.headers['set-cookie'][0];
      return res;
    });
    axiosA.interceptors.request.use(req => {
      if (cookieA) req.headers.Cookie = cookieA;
      return req;
    });

    const resA = await axiosA.post('/auth/signup', { name: 'User A', username: 'usera', email: 'a@a.com', password: 'password' });
    const userA = resA.data;
    console.log('[OK] User A signed up');

    await axiosA.post('/users/skills', { skillId: react._id, type: 'teach' });
    await axiosA.post('/users/skills', { skillId: nodejs._id, type: 'learn' });
    console.log('[OK] User A added skills');

    // 3. User B Signup & Add Skills
    const axiosB = axios.create({ baseURL: API_URL, withCredentials: true });
    let cookieB = '';
    axiosB.interceptors.response.use(res => {
      if (res.headers['set-cookie']) cookieB = res.headers['set-cookie'][0];
      return res;
    });
    axiosB.interceptors.request.use(req => {
      if (cookieB) req.headers.Cookie = cookieB;
      return req;
    });

    const resB = await axiosB.post('/auth/signup', { name: 'User B', username: 'userb', email: 'b@b.com', password: 'password' });
    const userB = resB.data;
    console.log('[OK] User B signed up');

    await axiosB.post('/users/skills', { skillId: nodejs._id, type: 'teach' });
    await axiosB.post('/users/skills', { skillId: react._id, type: 'learn' });
    console.log('[OK] User B added skills');

    // 4. User A Discover
    const { data: matches } = await axiosA.get('/discover');
    const matchB = matches.find(m => m.user._id === userB._id);
    if (matchB && matchB.score > 0) {
      console.log(`[OK] User A found User B in discover with score ${matchB.score}%`);
    } else {
      throw new Error('User B not found in discover or score is 0');
    }

    // 5. User A sends request
    const { data: request } = await axiosA.post('/exchange', { receiverId: userB._id });
    if (request.status === 'pending') {
      console.log('[OK] User A sent request, status is pending');
    }

    // 6. User B accepts request
    const { data: updatedReq } = await axiosB.put(`/exchange/${request._id}/status`, { status: 'accepted' });
    if (updatedReq.status === 'accepted') {
      console.log('[OK] User B accepted request');
    }

    // 7. Verify Unauthenticated Request
    try {
      await axios.get(`${API_URL}/auth/me`);
      throw new Error('Should have failed with 401');
    } catch (err) {
      if (err.response.status === 401) {
        console.log('[OK] Unauthenticated request correctly blocked with 401');
      } else {
        throw new Error('Wrong error code for unauthenticated request');
      }
    }

    console.log('--- ALL TESTS PASSED ---');
    process.exit(0);
  } catch (error) {
    console.error('--- TEST FAILED ---');
    console.error(error.message);
    if (error.response) console.error(error.response.data);
    process.exit(1);
  }
};

runTests();
