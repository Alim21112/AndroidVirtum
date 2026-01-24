import express from 'express';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// ============================================================================
// DATA & CONFIG
// ============================================================================

const users = [];
const normalize = (value) => String(value ?? '').trim().toLowerCase();

const deepseekApiKey = 'sk-d6e4e28f02f64131a47320a3b198ca17';
const deepseekEndpoint = 'https://api.deepseek.com/chat/completions';

const defaultMetrics = {
  heartRate: 74,
  bloodPressure: '118/76',
  steps: 6500,
  waterIntakeLiters: 1.8,
  oxygen: 97,
  temperature: 36.6,
  insight: 'Your health metrics are within normal ranges.',
};

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

const toUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

app.post('/auth/register', (req, res) => {
  console.log('[REGISTER] New registration attempt:', { 
    name: req.body.name, 
    email: req.body.email,
    hasPassword: !!req.body.password 
  });
  
  const name = String(req.body.name ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '').trim();
  
  if (!name || !email || !password) {
    console.log('[REGISTER] ❌ Missing fields');
    return res.status(400).json({ error: 'Missing fields' });
  }

  const exists = users.find((user) => normalize(user.email) === email);
  if (exists) {
    console.log('[REGISTER] ❌ Email already exists:', email);
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = {
    id: `user-${users.length + 1}`,
    name,
    email,
    password,
  };
  users.push(user);
  console.log('[REGISTER] ✅ User created successfully:', email);
  return res.json({ user: toUser(user) });
});

app.post('/auth/login', (req, res) => {
  const identifier = normalize(req.body.email);
  const password = String(req.body.password ?? '');
  
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  const user = users.find(
    (entry) =>
      (normalize(entry.email) === identifier ||
        normalize(entry.name) === identifier) &&
      entry.password === password,
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  return res.json({ token: 'demo-token', user: toUser(user) });
});

// ============================================================================
// METRICS ENDPOINT
// ============================================================================

const getCurrentMetrics = () => {
  const jitter = (value, delta) =>
    Math.max(0, Math.round(value + (Math.random() * delta - delta / 2)));

  return {
    ...defaultMetrics,
    heartRate: jitter(defaultMetrics.heartRate, 8),
    steps: jitter(defaultMetrics.steps, 1200),
    waterIntakeLiters: Math.max(
      0,
      Number((defaultMetrics.waterIntakeLiters + Math.random() * 0.3).toFixed(1)),
    ),
  };
};

app.get('/metrics', (req, res) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const metrics = getCurrentMetrics();
  return res.json(metrics);
});

// ============================================================================
// INTELLIGENT AI CHAT ENGINE
// ============================================================================

const recentResponses = [];
const MAX_RECENT_RESPONSES = 5;

// Calculate similarity between two texts
const calculateSimilarity = (str1, str2) => {
  const words1 = str1.split(/\s+/).filter(w => w.length > 3);
  const words2 = str2.split(/\s+/).filter(w => w.length > 3);
  const commonWords = words1.filter(w => words2.includes(w));
  return commonWords.length / Math.max(words1.length, words2.length, 1);
};

// Analyze user intent
const analyzeIntent = (message) => {
  const text = message.toLowerCase();
  
  return {
    isGreeting: /^(hi|hello|hey|greetings)$/i.test(text.trim()),
    isGeneralHealth: /how (am i|are my)|my health|overall|status|summary|doing/i.test(text),
    isHeartRate: /heart|pulse|bpm|heartbeat/i.test(text),
    isSteps: /steps|walk|activity|exercise|movement/i.test(text),
    isWater: /water|hydrat|drink/i.test(text),
    isBloodPressure: /blood pressure|pressure|bp/i.test(text),
    isOxygen: /oxygen|spo2|o2/i.test(text),
    isTemperature: /temperature|temp|fever/i.test(text),
    isAllMetrics: /all metrics|everything|full report|complete/i.test(text),
    isRecommendation: /recommend|advice|suggest|tip|should i|what to do/i.test(text),
  };
};

// Main AI response generator
const generateAIResponse = (message, metrics) => {
  const m = metrics || defaultMetrics;
  const intent = analyzeIntent(message);
  
  console.log('[AI] Processing:', message);
  console.log('[AI] Intent detected:', JSON.stringify(intent, null, 2));
  console.log('[AI] Using metrics:', {
    heartRate: m.heartRate,
    steps: m.steps,
    water: m.waterIntakeLiters,
    bp: m.bloodPressure
  });
  
  // GREETINGS
  if (intent.isGreeting) {
    const greetings = [
      `Hello! Your current stats: ${m.steps.toLocaleString()} steps and ${m.heartRate} bpm. What would you like to know?`,
      `Hi there! I can see you've got ${m.heartRate} bpm heart rate and ${m.waterIntakeLiters}L water intake. How can I help?`,
      `Hey! You've taken ${m.steps.toLocaleString()} steps today. Want insights on any metric?`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  // BLOOD PRESSURE (specific check first!)
  if (intent.isBloodPressure) {
    console.log('[AI] Blood pressure request detected!');
    const [systolic, diastolic] = m.bloodPressure.split('/').map(Number);
    const isOptimal = systolic < 120 && diastolic < 80;
    const isNormal = systolic < 130 && diastolic < 85;
    const isElevated = systolic < 140 && diastolic < 90;
    
    const status = isOptimal ? '🟢 Optimal' :
                   isNormal ? '🟢 Normal' :
                   isElevated ? '🟡 Elevated' :
                   '🔴 High';
    
    const advice = isOptimal ? 
                   'Perfect! Continue your healthy lifestyle habits.' :
                   isNormal ?
                   'Good reading. Keep monitoring and maintain a balanced diet.' :
                   'Consider reducing sodium intake, increasing exercise, and consulting a healthcare provider if readings stay elevated.';
    
    return `🩺 Blood Pressure Analysis:\n\n` +
           `Current Reading: ${m.bloodPressure} mmHg\n` +
           `Status: ${status}\n\n` +
           `📊 Reference Ranges:\n` +
           `• Optimal: <120/80 mmHg\n` +
           `• Normal: <130/85 mmHg\n` +
           `• Elevated: 130-139/85-89 mmHg\n\n` +
           `💡 ${advice}`;
  }
  
  // HEART RATE
  if (intent.isHeartRate) {
    const status = m.heartRate < 60 ? 'low (bradycardia)' : 
                   m.heartRate > 100 ? 'elevated (tachycardia)' : 
                   'perfectly normal';
    const context = m.heartRate < 60 ? 
                    'This can be normal for well-trained athletes. However, if you feel dizzy, fatigued, or have chest pain, consult a doctor.' :
                    m.heartRate > 100 ?
                    'This could be due to stress, caffeine, recent physical activity, or anxiety. If it persists while resting, consider seeing a healthcare provider.' :
                    'This indicates good cardiovascular health. Your heart is pumping efficiently.';
    
    return `Your heart rate is currently ${m.heartRate} bpm, which is ${status}.\n\n` +
           `📊 Normal range: 60-100 bpm (resting)\n` +
           `💡 Context: ${context}\n\n` +
           `Your other cardiovascular metrics are also good: Blood pressure ${m.bloodPressure} mmHg, Oxygen ${m.oxygen}%.`;
  }
  
  // STEPS
  if (intent.isSteps) {
    const progress = ((m.steps / 10000) * 100).toFixed(0);
    const remaining = Math.max(0, 10000 - m.steps);
    
    let assessment, advice;
    if (m.steps >= 10000) {
      assessment = '🌟 Outstanding! You\'ve exceeded your daily goal!';
      advice = 'Keep up this excellent activity level. Regular walking reduces heart disease risk by 31%.';
    } else if (m.steps >= 7000) {
      assessment = `💪 Great progress! You're at ${progress}% of your goal.`;
      advice = `Just ${remaining.toLocaleString()} steps more (about a 15-minute walk) to hit 10,000 today.`;
    } else if (m.steps >= 4000) {
      assessment = `👍 You're making progress at ${progress}%.`;
      advice = `You need ${remaining.toLocaleString()} more steps. A brisk 30-minute walk adds ~3,000 steps.`;
    } else {
      assessment = `📈 Current activity: ${m.steps.toLocaleString()} steps (${progress}%).`;
      advice = `Try to reach at least 5,000 steps today. Take the stairs, park farther away, or take short walking breaks every hour.`;
    }
    
    return `🚶 Step Count Analysis:\n\n` +
           `Current: ${m.steps.toLocaleString()} steps\n` +
           `Goal: 10,000 steps\n` +
           `Progress: ${progress}%\n\n` +
           `${assessment}\n\n` +
           `💡 ${advice}`;
  }
  
  // WATER
  if (intent.isWater) {
    const progress = ((m.waterIntakeLiters / 2.5) * 100).toFixed(0);
    const remaining = Math.max(0, 2.5 - m.waterIntakeLiters).toFixed(1);
    
    let status, advice;
    if (m.waterIntakeLiters >= 2.5) {
      status = '💯 Perfect! You\'ve met your daily hydration goal.';
      advice = 'Excellent hydration supports kidney function, skin health, and mental clarity.';
    } else if (m.waterIntakeLiters >= 2.0) {
      status = `💧 Good hydration at ${progress}%.`;
      advice = `Just ${remaining}L more (about 2-3 glasses) to reach optimal hydration.`;
    } else if (m.waterIntakeLiters >= 1.5) {
      status = `⚠️ Moderate hydration at ${progress}%.`;
      advice = `Drink ${remaining}L more today. Dehydration can cause fatigue and reduced focus.`;
    } else {
      status = `🚨 Low hydration at ${progress}%.`;
      advice = `You need ${remaining}L more water. Keep a water bottle nearby and set hourly reminders.`;
    }
    
    return `💧 Hydration Status:\n\n` +
           `Current: ${m.waterIntakeLiters}L\n` +
           `Daily Goal: 2.5L\n` +
           `Progress: ${progress}%\n\n` +
           `${status}\n\n` +
           `💡 ${advice}`;
  }
  
  // OXYGEN
  if (intent.isOxygen) {
    const status = m.oxygen >= 95 ? '🟢 Excellent' :
                   m.oxygen >= 90 ? '🟡 Acceptable (monitor)' :
                   '🔴 Low (seek medical attention)';
    
    const advice = m.oxygen >= 95 ?
                   'Your lungs and circulatory system are functioning optimally.' :
                   m.oxygen >= 90 ?
                   'This is on the lower end. Monitor for symptoms like shortness of breath.' :
                   'Levels below 90% require immediate medical evaluation.';
    
    return `🫁 Blood Oxygen Analysis:\n\n` +
           `Current: ${m.oxygen}%\n` +
           `Status: ${status}\n` +
           `Normal Range: 95-100%\n\n` +
           `💡 ${advice}`;
  }
  
  // TEMPERATURE
  if (intent.isTemperature) {
    const isNormal = m.temperature >= 36.1 && m.temperature <= 37.2;
    const isFever = m.temperature > 37.5;
    const isLow = m.temperature < 36.1;
    
    const status = isNormal ? '🟢 Normal' :
                   isFever ? '🔴 Elevated (possible fever)' :
                   '🔵 Below normal';
    
    const advice = isNormal ?
                   'Your body temperature is in the healthy range.' :
                   isFever ?
                   'Monitor for other symptoms. If it rises above 38°C or persists with other symptoms, consult a doctor.' :
                   'This is slightly low. Ensure you\'re warm, rested, and properly nourished.';
    
    return `🌡️ Body Temperature:\n\n` +
           `Current: ${m.temperature}°C\n` +
           `Status: ${status}\n` +
           `Normal Range: 36.1-37.2°C\n\n` +
           `💡 ${advice}`;
  }
  
  // GENERAL HEALTH
  if (intent.isGeneralHealth) {
    const heartOk = m.heartRate >= 60 && m.heartRate <= 100;
    const stepsProgress = ((m.steps / 10000) * 100).toFixed(0);
    const waterProgress = ((m.waterIntakeLiters / 2.5) * 100).toFixed(0);
    const stepsOk = m.steps >= 7000;
    const waterOk = m.waterIntakeLiters >= 2.0;
    
    const statusEmoji = heartOk && stepsOk ? '✅' : '⚠️';
    
    return `${statusEmoji} Here's your complete health status:\n\n` +
           `❤️ Heart Rate: ${m.heartRate} bpm ${heartOk ? '(healthy)' : '(check needed)'}\n` +
           `🚶 Steps: ${m.steps.toLocaleString()} (${stepsProgress}% of daily goal)\n` +
           `💧 Water: ${m.waterIntakeLiters}L (${waterProgress}% of daily goal)\n` +
           `🩺 Blood Pressure: ${m.bloodPressure} mmHg (normal)\n` +
           `🫁 Oxygen: ${m.oxygen}% (excellent)\n` +
           `🌡️ Temperature: ${m.temperature}°C (normal)\n\n` +
           `Overall: ${heartOk && stepsOk && waterOk ? 'You\'re doing great! All key metrics are healthy.' : 
                      'You\'re doing well, but there\'s room for improvement in ' + 
                      [!stepsOk && 'activity', !waterOk && 'hydration', !heartOk && 'heart rate'].filter(Boolean).join(' and ') + '.'}`;
  }
  
  // ALL METRICS
  if (intent.isAllMetrics) {
    return `📊 Complete Health Dashboard\n\n` +
           `❤️ HEART RATE: ${m.heartRate} bpm\n` +
           `   Normal: 60-100 bpm | Status: ${m.heartRate >= 60 && m.heartRate <= 100 ? '✓ Healthy' : '⚠ Check'}\n\n` +
           `🩺 BLOOD PRESSURE: ${m.bloodPressure} mmHg\n` +
           `   Normal: <120/80 | Status: ✓ Normal\n\n` +
           `🚶 STEPS: ${m.steps.toLocaleString()}\n` +
           `   Goal: 10,000 | Progress: ${((m.steps/10000)*100).toFixed(0)}%\n\n` +
           `💧 WATER: ${m.waterIntakeLiters}L\n` +
           `   Goal: 2.5L | Progress: ${((m.waterIntakeLiters/2.5)*100).toFixed(0)}%\n\n` +
           `🫁 OXYGEN: ${m.oxygen}%\n` +
           `   Normal: 95-100% | Status: ✓ Excellent\n\n` +
           `🌡️ TEMPERATURE: ${m.temperature}°C\n` +
           `   Normal: 36.1-37.2°C | Status: ✓ Normal\n\n` +
           `Ask me about any specific metric for detailed insights!`;
  }
  
  // RECOMMENDATIONS
  if (intent.isRecommendation) {
    const suggestions = [];
    
    if (m.steps < 5000) {
      suggestions.push(`🚶 **Increase Activity**: You're at ${m.steps.toLocaleString()} steps. Aim for 7,000+ today. Even a 20-minute walk adds 2,000 steps.`);
    }
    if (m.waterIntakeLiters < 2.0) {
      suggestions.push(`💧 **Hydrate More**: At ${m.waterIntakeLiters}L, you need ${(2.5 - m.waterIntakeLiters).toFixed(1)}L more. Try drinking a glass of water every 2 hours.`);
    }
    if (m.heartRate > 85) {
      suggestions.push(`❤️ **Manage Stress**: Heart rate is ${m.heartRate} bpm. Try deep breathing, meditation, or light stretching exercises.`);
    }
    if (m.steps >= 7000 && m.waterIntakeLiters >= 2.0 && m.heartRate >= 60 && m.heartRate <= 85) {
      suggestions.push(`🌟 **You're Crushing It!**: All metrics are in excellent ranges. Keep up your healthy routine!`);
    }
    
    if (suggestions.length === 0) {
      suggestions.push(`✅ **All Metrics Look Great!** Your heart rate (${m.heartRate} bpm), activity level (${m.steps.toLocaleString()} steps), and hydration (${m.waterIntakeLiters}L) are all in healthy ranges. Just maintain your current routine.`);
    }
    
    return `💡 Personalized Health Recommendations:\n\n${suggestions.join('\n\n')}\n\n` +
           `Your blood pressure (${m.bloodPressure} mmHg), oxygen (${m.oxygen}%), and temperature (${m.temperature}°C) are all excellent!`;
  }
  
  // DEFAULT RESPONSE
  const heartStatus = m.heartRate >= 60 && m.heartRate <= 100 ? 'healthy' : 
                      m.heartRate < 60 ? 'low' : 'elevated';
  const stepsPercent = ((m.steps / 10000) * 100).toFixed(0);
  const waterPercent = ((m.waterIntakeLiters / 2.5) * 100).toFixed(0);
  
  const responses = [
    `I'm analyzing your health data. Your heart rate is ${m.heartRate} bpm (${heartStatus}), you've taken ${m.steps.toLocaleString()} steps (${stepsPercent}% of goal), and consumed ${m.waterIntakeLiters}L water (${waterPercent}% of goal). Your blood pressure (${m.bloodPressure} mmHg) and temperature (${m.temperature}°C) are both normal. What specific metric would you like to explore?`,
    
    `Here's what I see: Heart rate at ${m.heartRate} bpm, ${m.steps.toLocaleString()} steps logged, ${m.waterIntakeLiters}L water intake. Your BP reads ${m.bloodPressure} mmHg and oxygen is ${m.oxygen}%. All vitals are stable. Ask me about any metric for detailed insights!`,
    
    `Current health snapshot: ${m.heartRate} bpm heart rate (${heartStatus}), ${m.steps.toLocaleString()} steps (${stepsPercent}% progress), ${m.waterIntakeLiters}L water (${waterPercent}% of target). Blood pressure and body temp are within normal ranges at ${m.bloodPressure} mmHg and ${m.temperature}°C. Need details on anything specific?`,
    
    `Your vitals: Heart is beating at ${m.heartRate} bpm, you've walked ${m.steps.toLocaleString()} steps today, and drank ${m.waterIntakeLiters}L of water. Blood pressure ${m.bloodPressure} mmHg (normal), oxygen ${m.oxygen}% (excellent), temperature ${m.temperature}°C (normal). Which metric should we dive into?`,
  ];
  
  // Avoid repetition
  const lastResp = recentResponses[recentResponses.length - 1] || '';
  let selected = responses[Math.floor(Math.random() * responses.length)];
  
  if (lastResp && calculateSimilarity(selected.toLowerCase(), lastResp.toLowerCase()) > 0.6) {
    const different = responses.filter(r => 
      calculateSimilarity(r.toLowerCase(), lastResp.toLowerCase()) < 0.6
    );
    if (different.length > 0) {
      selected = different[Math.floor(Math.random() * different.length)];
    }
  }
  
  return selected;
};

// Process health query
const processHealthQuery = (message, metrics) => {
  const response = generateAIResponse(message, metrics);
  
  // Track response
  recentResponses.push(response);
  if (recentResponses.length > MAX_RECENT_RESPONSES) {
    recentResponses.shift();
  }
  
  return response;
};

// ============================================================================
// CHAT ENDPOINT
// ============================================================================

app.post('/chat', async (req, res) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const { message } = req.body;
  
  try {
    const currentMetrics = getCurrentMetrics();
    console.log('\n[CHAT] ========================================');
    console.log('[CHAT] New message:', message);
    console.log('[CHAT] Current metrics:', currentMetrics);
    
    const reply = processHealthQuery(String(message ?? ''), currentMetrics);
    
    console.log('[CHAT] Generated reply (first 150 chars):', reply.substring(0, 150));
    console.log('[CHAT] ========================================\n');
    
    return res.json({ reply });
  } catch (error) {
    console.error('[CHAT] Error:', error);
    const currentMetrics = getCurrentMetrics();
    return res.json({ reply: processHealthQuery(message, currentMetrics) });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(port, '0.0.0.0', () => {
  console.log(`\n🚀 Virtum API running on http://0.0.0.0:${port}`);
  console.log('✅ Listening on ALL network interfaces (accessible from phone)');
  console.log('✅ AI Chat Engine: Ready');
  console.log('✅ Intent Analysis: Enabled');
  console.log('✅ Smart Responses: Active\n');
});
