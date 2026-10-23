package in.srcenterprises.api;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
@Entity @Table(name="promotions")
public class Promotion {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @NotBlank @Size(max=130) public String title;
 @Size(max=1500) public String description;
 @Size(max=80) public String category;
 @Size(max=1000) public String imageUrl;
 public LocalDate startsOn;
 public LocalDate endsOn;
 @NotNull public Boolean published=false;
 @NotNull public Boolean informationOnly=true;
 @Version public Long version;
}