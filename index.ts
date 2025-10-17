export type DeferredCallback = () => Promise<void> | void;
export class DeferQueue {
    name = "";
    asyncList: DeferredCallback[] = [];
    syncList: DeferredCallback[] = [];
    constructor(name = "") {
        this.name = name;
    }
    appendSync(deferredCallback: DeferredCallback) {
        this.syncList.push(deferredCallback);
    }

    appendAsync(deferredCallback: DeferredCallback) {
        this.asyncList.push(deferredCallback);
    }

    async defer() {
        await Promise.all([
            ...this.asyncList.map(async (cb) => {
                try {
                    await cb();
                } catch (error) {
                    console.error(this.name, "failed to perform async deferred function", error);
                }
            }),
            (async () => {
                while (this.syncList.length) {
                    const cb = this.syncList.shift()!;
                    try {
                        await cb();
                    } catch (error) {
                        console.error(this.name, "Failed to run sync deferred callback", error);
                    }
                }
            })(),
        ]);
    }
}

export default DeferQueue;
