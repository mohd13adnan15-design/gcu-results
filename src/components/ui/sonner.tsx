import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ closeButton = true, toastOptions, ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton={closeButton}
      toastOptions={{
        closeButtonAriaLabel: "Dismiss notification",
        ...toastOptions,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "h-6 w-6 border-0 bg-background/80 opacity-70 transition-opacity hover:opacity-100 [&>svg]:h-3.5 [&>svg]:w-3.5",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
