import Link from "next/link";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { requirePermission } from "@/lib/permissions";
import { PermissionKey } from "@prisma/client";
import { normalizeBambuConfiguration } from "@/lib/bambu";
import { sendBambuCommandAction } from "@/app/actions";
import BambuCameraViewer from "@/components/BambuCameraViewer";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function BambuDashboard({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission(PermissionKey.INTEGRATIONS_VIEW);

  const params = await searchParams;
  const row = await db.integrationSetting.findUnique({ where: { provider: "BAMBU" } });
  let printers: any[] = [];

  if (row?.encryptedJson) {
    try {
      printers = normalizeBambuConfiguration(JSON.parse(decryptSecret(row.encryptedJson))).printers;
    } catch {
      printers = [];
    }
  }

  return (
    <>
      <div className="top bambuPageHeader">
        <div>
          <h1>Bambu Printers</h1>
          <p className="muted">Compact live-camera cards and private LAN printer controls.</p>
        </div>
        <Link className="secondary" href="/settings/bambu">
          Configure
        </Link>
      </div>

      {params.success && <div className="alert goodText">Command sent: {params.success}</div>}
      {params.error && (
        <div className="alert">Command failed. Confirm the integration and bridge settings.</div>
      )}
      {!row?.enabled && <div className="alert">The Bambu integration is disabled.</div>}

      <div className="bambuPrinterGrid section">
        {printers.map((printer) => (
          <section className="card bambuPrinterCard" key={printer.id}>
            <div className="top compact bambuPrinterHeading">
              <div>
                <h2>{printer.name}</h2>
                <p className="muted">
                  {printer.manufacturer} {printer.model} · {printer.host}
                </p>
                <p className="muted bambuSerial">{printer.serialNumber}</p>
              </div>
              <span className={row?.enabled ? "pill good" : "pill"}>
                {row?.enabled ? "Configured" : "Disabled"}
              </span>
            </div>

            {printer.cameraUrl ? (
              <BambuCameraViewer src={printer.cameraUrl} printerName={printer.name} />
            ) : (
              <div className="alert">No browser-viewable camera URL configured.</div>
            )}

            <div className="actions bambuControls">
              {["pause", "resume", "stop", "light-on", "light-off"].map((command) => (
                <form action={sendBambuCommandAction} key={command}>
                  <input type="hidden" name="printerId" value={printer.id} />
                  <input type="hidden" name="command" value={command} />
                  <button
                    className={`${command === "stop" ? "danger" : "secondary"} small`}
                    disabled={!printer.bridgeUrl}
                  >
                    {command.replace("-", " ")}
                  </button>
                </form>
              ))}
            </div>

            {!printer.bridgeUrl && (
              <p className="muted bambuBridgeNote">
                Add a compatible <code>bridgeUrl</code> to enable controls.
              </p>
            )}
          </section>
        ))}

        {!printers.length && (
          <section className="card">
            <p>No Bambu printers are configured.</p>
          </section>
        )}
      </div>
    </>
  );
}
