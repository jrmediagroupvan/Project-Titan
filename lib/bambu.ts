export type BambuPrinterConfig = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  connection: "local" | "bridge";
  host: string;
  serialNumber: string;
  accessCode: string;
  mqtt: {
    enabled: boolean;
    port: number;
    username: string;
    tls: boolean;
    rejectUnauthorized: boolean;
  };
  ftp: {
    enabled: boolean;
    port: number;
    tls: boolean;
  };
  cameraUrl?: string;
  bridgeUrl?: string;
  bridgeToken?: string;
};

export type BambuConfiguration = { printers: BambuPrinterConfig[] };

export const emptyBambuPrinter = (): BambuPrinterConfig => ({
  id: "bambu-main",
  name: "My Bambu Printer",
  manufacturer: "Bambu Lab",
  model: "A1",
  connection: "local",
  host: "",
  serialNumber: "",
  accessCode: "",
  mqtt: { enabled: true, port: 8883, username: "bblp", tls: true, rejectUnauthorized: false },
  ftp: { enabled: true, port: 990, tls: true },
  cameraUrl: "",
  bridgeUrl: "",
  bridgeToken: "",
});

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function bool(value: unknown, fallback: boolean) { return typeof value === "boolean" ? value : fallback; }
function port(value: unknown, fallback: number) { const n=Number(value); return Number.isInteger(n)&&n>0&&n<65536?n:fallback; }

export function normalizeBambuConfiguration(value: unknown, options: { allowMissingSecrets?: boolean } = {}): BambuConfiguration {
  if (!value || typeof value !== "object" || !Array.isArray((value as any).printers)) throw new Error("Configuration must contain a printers array.");
  const printers=(value as any).printers.map((raw:any,index:number)=>{
    const defaults=emptyBambuPrinter();
    const printer:BambuPrinterConfig={
      id:text(raw?.id,`bambu-${index+1}`),
      name:text(raw?.name,`Bambu Printer ${index+1}`),
      manufacturer:text(raw?.manufacturer,"Bambu Lab"),
      model:text(raw?.model,"A1"),
      connection:raw?.connection==="bridge"?"bridge":"local",
      host:text(raw?.host),
      serialNumber:text(raw?.serialNumber),
      accessCode:text(raw?.accessCode),
      mqtt:{
        enabled:bool(raw?.mqtt?.enabled,defaults.mqtt.enabled),
        port:port(raw?.mqtt?.port,defaults.mqtt.port),
        username:text(raw?.mqtt?.username,defaults.mqtt.username),
        tls:bool(raw?.mqtt?.tls,defaults.mqtt.tls),
        rejectUnauthorized:bool(raw?.mqtt?.rejectUnauthorized,defaults.mqtt.rejectUnauthorized),
      },
      ftp:{
        enabled:bool(raw?.ftp?.enabled,defaults.ftp.enabled),
        port:port(raw?.ftp?.port,defaults.ftp.port),
        tls:bool(raw?.ftp?.tls,defaults.ftp.tls),
      },
      cameraUrl:text(raw?.cameraUrl),
      bridgeUrl:text(raw?.bridgeUrl).replace(/\/$/,""),
      bridgeToken:text(raw?.bridgeToken),
    };
    if(!printer.id||!printer.name||!printer.host||!printer.serialNumber||(!options.allowMissingSecrets&&!printer.accessCode)) throw new Error(`Printer ${index+1} requires id, name, host, serialNumber and accessCode.`);
    return printer;
  });
  if(!printers.length) throw new Error("Add at least one printer.");
  const ids=new Set<string>();
  for(const printer of printers){if(ids.has(printer.id))throw new Error(`Duplicate printer id: ${printer.id}`);ids.add(printer.id);}
  return {printers};
}

export function publicBambuConfiguration(config:BambuConfiguration):BambuConfiguration{
  return {printers:config.printers.map(p=>({...p,accessCode:"",bridgeToken:""}))};
}
