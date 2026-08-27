export class SingleFlight<TKey> {
  private readonly activeOperations = new Map<TKey, Promise<unknown>>();

  run<TResult>(key: TKey, operation: () => Promise<TResult>): Promise<TResult> {
    const activeOperation = this.activeOperations.get(key) as Promise<TResult> | undefined;
    if (activeOperation !== undefined) {
      return activeOperation;
    }

    const nextOperation = operation().finally(() => {
      if (this.activeOperations.get(key) === nextOperation) {
        this.activeOperations.delete(key);
      }
    });
    this.activeOperations.set(key, nextOperation);
    return nextOperation;
  }
}
