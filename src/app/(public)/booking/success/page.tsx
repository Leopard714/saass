import { CheckCircle, CalendarCheck, House } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export const metadata = {
  title: "Booking Confirmed | RC Beauty Salon",
  description: "Your appointment has been successfully booked",
}

export default function BookingSuccessPage() {
  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle size={48} weight="fill" className="text-green-600 dark:text-green-400" />
          </div>

          <CardTitle className="text-2xl">Booking Confirmed!</CardTitle>

          <CardDescription className="text-base">
            Your appointment has been successfully booked.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="text-muted-foreground">
              A confirmation email will be sent shortly with your appointment details.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/my-appointments">
                <CalendarCheck size={20} className="mr-2" weight="regular" />
                View My Appointments
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link href="/">
                <House size={20} className="mr-2" weight="regular" />
                Back to Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}