import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEAM_MEMBERS = [
  {
    id: 'usr_me',
    name: 'Suraj',
    handle: '@suraj',
    monogram: 'SJ',
    role: 'Studio Principal',
    status: 'online',
    statusText: 'Polishing Fable v2 design systems',
    avatarColor: '#2D3748',
    email: 'suraj@fable.studio',
    password: 'password123',
  },
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

const CHANNELS = [
  {
    id: 'ch_design_crit',
    name: 'design-crit',
    topic: 'Atelier critiques, typographic balance & macro whitespace audit',
    type: 'text',
    memberCount: 6,
    unreadCount: 2,
    activeCall: { mode: 'audio', participantCount: 3, startedAt: '14m ago' },
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
    activeCall: { mode: 'audio', participantCount: 2, startedAt: '38m ago' },
  },
];

const MESSAGES = [
  {
    id: 'msg_1',
    channelId: 'ch_design_crit',
    senderId: 'usr_elena',
    timestamp: '10:14 AM',
    content: 'I replaced the generic sans with high-contrast Newsreader serifs for display titles. Notice how the negative letter-spacing (-0.02em) makes the editorial headline hold its weight without needing aggressive bolding.',
    isPinned: true,
    reactions: [
      { icon: 'sparkle', userId: 'usr_me' },
      { icon: 'sparkle', userId: 'usr_julian' },
      { icon: 'sparkle', userId: 'usr_soren' },
      { icon: 'sparkle', userId: 'usr_maya' },
      { icon: 'check', userId: 'usr_julian' },
      { icon: 'check', userId: 'usr_soren' },
    ],
  },
  {
    id: 'msg_2',
    channelId: 'ch_design_crit',
    senderId: 'usr_soren',
    timestamp: '10:19 AM',
    content: "Strongly agree. Also checked the active press physics. Following Emil Kowalski's philosophy: no keyframes on instant toggles, and all buttons scale down to 0.97 with 160ms ease-out.",
    codeSnippet: {
      language: 'css',
      code: `.button {\n  transition: transform 160ms var(--ease-out);\n}\n.button:active {\n  transform: scale(0.97);\n}`,
    },
    reactions: [
      { icon: 'heart', userId: 'usr_me' },
      { icon: 'heart', userId: 'usr_elena' },
      { icon: 'heart', userId: 'usr_julian' },
    ],
  },
  {
    id: 'msg_3',
    channelId: 'ch_design_crit',
    senderId: 'usr_julian',
    timestamp: '10:24 AM',
    content: 'Recorded a quick audio thought on the spatial balance between the message stream and the floating huddle dock. Have a listen:',
    voiceNote: {
      duration: '0:34',
      waveform: [28, 45, 60, 35, 80, 95, 70, 40, 25, 55, 75, 88, 65, 45, 30, 60, 85, 92, 48, 30],
    },
    reactions: [
      { icon: 'sparkle', userId: 'usr_elena' },
      { icon: 'sparkle', userId: 'usr_soren' },
    ],
  },
  {
    id: 'msg_4',
    channelId: 'ch_design_crit',
    senderId: 'usr_me',
    timestamp: '10:28 AM',
    content: 'The audio note is spot-on Julian. I am bringing up the live video and spatial audio huddle dock directly into Fable so we can transition from async text to instant voice with zero context switching.',
    reactions: [
      { icon: 'check', userId: 'usr_me' },
      { icon: 'check', userId: 'usr_elena' },
      { icon: 'check', userId: 'usr_julian' },
      { icon: 'check', userId: 'usr_soren' },
    ],
  },
  {
    id: 'msg_at_1',
    channelId: 'ch_atelier',
    senderId: 'usr_maya',
    timestamp: '09:40 AM',
    content: 'Testing the ambient noise texture overlay. At 0.025 opacity it adds physical paper warmth without muddying the dark mode charcoal surface.',
  },
  {
    id: 'msg_at_2',
    channelId: 'ch_atelier',
    senderId: 'usr_elena',
    timestamp: '09:48 AM',
    content: 'Confirmed on both OLED and ProMotion displays. The tactile feel is unmistakable.',
  },
  {
    id: 'msg_mo_1',
    channelId: 'ch_motion_lab',
    senderId: 'usr_soren',
    timestamp: 'Yesterday',
    content: 'Banned all standard ease-in entrances. When cards reveal, they enter immediately with max velocity and settle smoothly with cubic-bezier(0.16, 1, 0.3, 1).',
    codeSnippet: {
      language: 'css',
      code: `/* Entrance curve */\n--ease-out: cubic-bezier(0.16, 1, 0.3, 1);`,
    },
  },
];

async function main() {
  console.log('🌱 Seeding PostgreSQL database for Fable...');

  // 1. Seed Users
  for (const member of TEAM_MEMBERS) {
    await prisma.user.upsert({
      where: { id: member.id },
      update: {
        name: member.name,
        handle: member.handle,
        monogram: member.monogram,
        role: member.role,
        status: member.status,
        statusText: member.statusText,
        avatarColor: member.avatarColor,
      },
      create: {
        id: member.id,
        name: member.name,
        handle: member.handle,
        monogram: member.monogram,
        role: member.role,
        status: member.status,
        statusText: member.statusText,
        avatarColor: member.avatarColor,
      },
    });

    // Create account for Suraj (the demo user)
    if ('email' in member && member.email && member.password) {
      const hashedPassword = await bcrypt.hash(member.password, 12);
      await prisma.account.upsert({
        where: { userId: member.id },
        update: { email: member.email, password: hashedPassword },
        create: {
          email: member.email,
          password: hashedPassword,
          userId: member.id,
        },
      });
    }
  }
  console.log(`✓ Seeded ${TEAM_MEMBERS.length} users + demo account`);

  // 2. Seed Channels
  for (const channel of CHANNELS) {
    await prisma.channel.upsert({
      where: { id: channel.id },
      update: {
        name: channel.name,
        topic: channel.topic,
        type: channel.type,
        unreadCount: channel.unreadCount || 0,
        memberCount: channel.memberCount,
        activeCall: channel.activeCall as object | undefined,
      },
      create: {
        id: channel.id,
        name: channel.name,
        topic: channel.topic,
        type: channel.type,
        unreadCount: channel.unreadCount || 0,
        memberCount: channel.memberCount,
        activeCall: channel.activeCall as object | undefined,
      },
    });
  }
  console.log(`✓ Seeded ${CHANNELS.length} channels`);

  // 3. Seed Messages and Reactions
  for (const msg of MESSAGES) {
    await prisma.message.upsert({
      where: { id: msg.id },
      update: {
        content: msg.content,
        timestamp: msg.timestamp,
        codeSnippet: msg.codeSnippet as object | undefined,
        voiceNote: msg.voiceNote as object | undefined,
        isPinned: msg.isPinned || false,
      },
      create: {
        id: msg.id,
        channelId: msg.channelId,
        senderId: msg.senderId,
        timestamp: msg.timestamp,
        content: msg.content,
        codeSnippet: msg.codeSnippet as object | undefined,
        voiceNote: msg.voiceNote as object | undefined,
        isPinned: msg.isPinned || false,
      },
    });

    if (msg.reactions) {
      for (const reaction of msg.reactions) {
        await prisma.reaction.upsert({
          where: {
            messageId_userId_icon: {
              messageId: msg.id,
              userId: reaction.userId,
              icon: reaction.icon,
            },
          },
          update: {},
          create: {
            messageId: msg.id,
            userId: reaction.userId,
            icon: reaction.icon,
          },
        });
      }
    }
  }
  console.log('✓ Seeded initial messages & reactions');

  // 4. Seed Settings
  await prisma.workspaceSetting.upsert({
    where: { id: 'default_settings' },
    update: {},
    create: {
      id: 'default_settings',
    },
  });
  console.log('✓ Seeded workspace settings');

  console.log('');
  console.log('✨ Database seeding completed!');
  console.log('📧 Demo login: suraj@fable.studio / password123');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
