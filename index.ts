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
        const results:( {
            type: "success"; 
            result: any; 
        } | {
            type: "failed"; 
            error: any; 
        })[] = []
        await Promise.all([
            ...this.asyncList.map(async (cb) => {
                try {
                   const  result =  await cb();
                   results.push({
                    type: "success", 
                    result, 
                   })
                } catch (error) {
                    console.error(this.name, "failed to perform async deferred function", error);
                    results.push({
                        type: "failed", 
                        error,
                    })
                }
            }),
            (async () => {
                while (this.syncList.length) {
                    const cb = this.syncList.pop()!;
                    try {
                        const result = await cb();
                        results.push({
                            type: "success", 
                            result,
                        })
                    } catch (error) {
                        console.error(this.name, "Failed to run sync deferred callback", error);
                        results.push({
                            type: 'failed', 
                            error,
                        })
                    }
                }
            })(),
        ]);
        return results; 
    }
}

export default DeferQueue;
