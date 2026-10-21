export function callingEnvironment(env?: NodeJS.ProcessEnv): {
  sfu: {
    enabled: boolean;
    address: string | undefined;
    listenIp: string;
    minimum: number;
    maximum: number;
  };
  icePolicy: "all" | "relay";
};
