"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function UiKitInteractive() {
  return (
    <section aria-labelledby="interactive" className="flex flex-col gap-6">
      <h2 id="interactive" className="text-2xl font-semibold">Dialog &amp; tabs</h2>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" className="w-fit">Open dialog</Button>
        </DialogTrigger>
        <DialogContent title="Download sensitivity card" description="A PNG with your configuration.">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button>Download</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Tabs defaultValue="camera">
        <TabsList aria-label="Sensitivity categories">
          <TabsTrigger value="camera">Camera</TabsTrigger>
          <TabsTrigger value="ads">ADS</TabsTrigger>
          <TabsTrigger value="gyro">Gyroscope</TabsTrigger>
          <TabsTrigger value="ads_gyro">ADS Gyroscope</TabsTrigger>
        </TabsList>
        <TabsContent value="camera" className="text-sm text-muted">Camera panel</TabsContent>
        <TabsContent value="ads" className="text-sm text-muted">ADS panel</TabsContent>
        <TabsContent value="gyro" className="text-sm text-muted">Gyroscope panel</TabsContent>
        <TabsContent value="ads_gyro" className="text-sm text-muted">ADS Gyroscope panel</TabsContent>
      </Tabs>
    </section>
  );
}
