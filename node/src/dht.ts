import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { bootstrap } from "@libp2p/bootstrap";
import { identify } from "@libp2p/identify";
import { kadDHT } from "@libp2p/kad-dht";
import { ping } from "@libp2p/ping";
import { tcp } from "@libp2p/tcp";
import { createLibp2p } from "libp2p";

export async function createDHTNode(
	listenPort: number = 4001,
	bootstrapPeers?: string[],
) {
	const peerList =
		bootstrapPeers ??
		(process.env.BOOTSTRAP_PEERS?.split(",").filter(Boolean) || undefined);

	const node = await createLibp2p({
		transports: [tcp()],
		connectionEncrypters: [noise()],
		streamMuxers: [yamux()],
		addresses: {
			listen: [`/ip4/0.0.0.0/tcp/${listenPort}`],
		},
		services: {
			dht: kadDHT({
				clientMode: false,
				// GLM 5.1: aggressive refresh in high-churn environments
				kBucketSize: 20,
			}),
			identify: identify(),
			ping: ping(),
			...(peerList ? { bootstrap: bootstrap({ list: peerList }) } : {}),
		},
	});

	return node;
}
