import { User, Channel, Message, CallParticipant, WorkspaceSettings } from '../types/chat';

export const CURRENT_USER: User = {
  id: 'usr_me',
  name: 'Suraj',
  handle: '@suraj',
  monogram: 'SJ',
  role: 'Studio Principal',
  status: 'online',
  statusText: 'Polishing Fable v2 design systems',
  avatarColor: '#2D3748',
};

export const TEAM_MEMBERS: User[] = [
  CURRENT_USER,
  {
    id: 'usr_elena',
    name: 'Elena Rostova',
    handle: '@elena',
    monogram: 'ER',
    role: 'Head of Typography',
    status: 'in-huddle',
    statusText: 'Reviewing Newsreader ligatures',
    avatarColor: '#1A365D',
  },
  {
    id: 'usr_julian',
    name: 'Julian Thorne',
    handle: '@julian',
    monogram: 'JT',
    role: 'Creative Director',
    status: 'online',
    statusText: 'In studio listening session',
    avatarColor: '#2A4365',
  },
  {
    id: 'usr_soren',
    name: 'Soren Lindqvist',
    handle: '@soren',
    monogram: 'SL',
    role: 'Motion & Interaction Lead',
    status: 'online',
    statusText: 'Fine-tuning Emil cubic bezier curves',
    avatarColor: '#22543D',
  },
  {
    id: 'usr_maya',
    name: 'Maya Chen',
    handle: '@maya',
    monogram: 'MC',
    role: 'Systems Architect',
    status: 'idle',
    statusText: 'Away for pour-over coffee',
    avatarColor: '#4A5568',
  },
  {
    id: 'usr_kenji',
    name: 'Kenji Sato',
    handle: '@kenji',
    monogram: 'KS',
    role: 'Acoustic & WebRTC Engineer',
    status: 'offline',
    statusText: 'Back tomorrow at 9 AM',
    avatarColor: '#3C366B',
  },
];

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'ch_design_crit',
    name: 'design-crit',
    topic: 'Atelier critiques, typographic balance & macro whitespace audit',
    type: 'text',
    memberCount: 6,
    unreadCount: 2,
    activeCall: {
      mode: 'audio',
      participantCount: 3,
      startedAt: '14m ago',
    },
  },
  {
    id: 'ch_atelier',
    name: 'atelier-wip',
    topic: 'Unpublished sketches, tactile UI experiments, and micro-animations',
    type: 'text',
    memberCount: 5,
  },
  {
    id: 'ch_motion_lab',
    name: 'motion-lab',
    topic: 'Spring curves, GPU paint performance & 160ms haptic transitions',
    type: 'text',
    memberCount: 4,
    unreadCount: 1,
  },
  {
    id: 'ch_studio_stage',
    name: 'studio-stage',
    topic: 'Direct video salon & weekly design review broadcast',
    type: 'video',
    memberCount: 6,
  },
  {
    id: 'ch_spatial_huddle',
    name: 'spatial-huddle',
    topic: 'Open ambient audio room — drop in to listen or speak',
    type: 'audio',
    memberCount: 6,
    activeCall: {
      mode: 'audio',
      participantCount: 2,
      startedAt: '38m ago',
    },
  },
];

export const INITIAL_MESSAGES: Record<string, Message[]> = {
  ch_design_crit: [
    {
      id: 'msg_1',
      channelId: 'ch_design_crit',
      sender: TEAM_MEMBERS[1], // Elena
      timestamp: '10:14 AM',
      content: 'I replaced the generic sans with high-contrast Newsreader serifs for display titles. Notice how the negative letter-spacing (-0.02em) makes the editorial headline hold its weight without needing aggressive bolding.',
      reactions: [
        { icon: 'sparkle', count: 4, reactedByMe: true },
        { icon: 'check', count: 2, reactedByMe: false },
      ],
      isPinned: true,
    },
    {
      id: 'msg_2',
      channelId: 'ch_design_crit',
      sender: TEAM_MEMBERS[3], // Soren
      timestamp: '10:19 AM',
      content: 'Strongly agree. Also checked the active press physics. Following Emil Kowalski’s philosophy: no keyframes on instant toggles, and all buttons scale down to 0.97 with 160ms ease-out.',
      codeSnippet: {
        language: 'css',
        code: `.button {\n  transition: transform 160ms var(--ease-out);\n}\n.button:active {\n  transform: scale(0.97);\n}`,
      },
      reactions: [
        { icon: 'heart', count: 3, reactedByMe: true },
      ],
    },
    {
      id: 'msg_3',
      channelId: 'ch_design_crit',
      sender: TEAM_MEMBERS[2], // Julian
      timestamp: '10:24 AM',
      content: 'Recorded a quick audio thought on the spatial balance between the message stream and the floating huddle dock. Have a listen:',
      voiceNote: {
        duration: '0:34',
        waveform: [28, 45, 60, 35, 80, 95, 70, 40, 25, 55, 75, 88, 65, 45, 30, 60, 85, 92, 48, 30],
      },
      reactions: [
        { icon: 'sparkle', count: 2, reactedByMe: false },
      ],
    },
    {
      id: 'msg_4',
      channelId: 'ch_design_crit',
      sender: CURRENT_USER,
      timestamp: '10:28 AM',
      content: 'The audio note is spot-on Julian. I am bringing up the live video and spatial audio huddle dock directly into Fable so we can transition from async text to instant voice with zero context switching.',
      reactions: [
        { icon: 'check', count: 4, reactedByMe: true },
      ],
    },
  ],
  ch_atelier: [
    {
      id: 'msg_at_1',
      channelId: 'ch_atelier',
      sender: TEAM_MEMBERS[4], // Maya
      timestamp: '09:40 AM',
      content: 'Testing the ambient noise texture overlay. At 0.025 opacity it adds physical paper warmth without muddying the dark mode charcoal surface.',
    },
    {
      id: 'msg_at_2',
      channelId: 'ch_atelier',
      sender: TEAM_MEMBERS[1], // Elena
      timestamp: '09:48 AM',
      content: 'Confirmed on both OLED and ProMotion displays. The tactile feel is unmistakable.',
    },
  ],
  ch_motion_lab: [
    {
      id: 'msg_mo_1',
      channelId: 'ch_motion_lab',
      sender: TEAM_MEMBERS[3], // Soren
      timestamp: 'Yesterday',
      content: 'Banned all standard ease-in entrances. When cards reveal, they enter immediately with max velocity and settle smoothly with cubic-bezier(0.16, 1, 0.3, 1).',
      codeSnippet: {
        language: 'css',
        code: `/* Entrance curve */\n--ease-out: cubic-bezier(0.16, 1, 0.3, 1);`,
      },
    },
  ],
};

export const INITIAL_CALL_PARTICIPANTS: CallParticipant[] = [
  {
    id: 'part_me',
    user: CURRENT_USER,
    isSpeaking: false,
    isMuted: false,
    isVideoOn: false,
    isScreenSharing: false,
    audioLevel: 18,
    accentColor: '#1E293B',
  },
  {
    id: 'part_elena',
    user: TEAM_MEMBERS[1],
    isSpeaking: true,
    isMuted: false,
    isVideoOn: true,
    isScreenSharing: false,
    audioLevel: 74,
    accentColor: '#0F172A',
  },
  {
    id: 'part_julian',
    user: TEAM_MEMBERS[2],
    isSpeaking: false,
    isMuted: false,
    isVideoOn: true,
    isScreenSharing: false,
    audioLevel: 0,
    accentColor: '#172554',
  },
  {
    id: 'part_soren',
    user: TEAM_MEMBERS[3],
    isSpeaking: false,
    isMuted: true,
    isVideoOn: false,
    isScreenSharing: false,
    audioLevel: 0,
    accentColor: '#064E3B',
  },
];

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  micDeviceId: 'default',
  cameraDeviceId: 'default',
  speakerDeviceId: 'default',
  noiseCancellation: true,
  spatialAudio: true,
  theme: 'dark',
  inputVolume: 85,
  outputVolume: 90,
};
